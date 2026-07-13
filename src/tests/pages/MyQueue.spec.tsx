import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import { resetTasks, makeTask, MOCK_CURRENT_ACTOR } from "../mocks/handlers";
import { setTokens } from "@/lib/tokenStorage";
import { AuthProvider } from "@/lib/auth";
import { VALID_ACCESS_TOKEN } from "../mocks/handlers";
import { connectRealtime } from "@/lib/realtime";
import ListView from "../../pages/ListView.tsx";

const SOMEONE_ELSE = { id: "someone-else", name: "Outra Pessoa", type: "human" as const };

/** jsdom has no IntersectionObserver — ListView's infinite-scroll sentinel needs a stub. */
class FakeIntersectionObserver {
    observe() {}
    disconnect() {}
    unobserve() {}
}

function renderMyQueue() {
    const queryClient = new QueryClient();
    const result = render(
        <QueryClientProvider client={queryClient}>
            <MemoryRouter>
                <AuthProvider>
                    <ListView presetMyQueue />
                </AuthProvider>
            </MemoryRouter>
        </QueryClientProvider>
    );
    return { ...result, queryClient };
}

/** A minimal WebSocket stand-in — same pattern as Realtime.spec.tsx. */
function createFakeSocket() {
    return {
        onmessage: null as ((event: MessageEvent) => void) | null,
        onclose: null as (() => void) | null,
        close: () => {
            /* no-op */
        },
    } as unknown as WebSocket;
}

describe("Minhas Tarefas / Fila de Avaliação", () => {
    beforeEach(() => {
        vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("reflete a regra de relevância: papel compatível E (sou colaborador OU sem colaborador)", async () => {
        setTokens(VALID_ACCESS_TOKEN, "refresh-token-value");
        resetTasks([
            makeTask({
                id: "t-unassigned",
                task_key: "FAC-1",
                title: "Triagem sem colaborador",
                status: "TRIAGEM",
                collaborators: [],
            }),
            makeTask({
                id: "t-mine",
                task_key: "FAC-2",
                title: "Triagem minha",
                status: "TRIAGEM",
                collaborators: [MOCK_CURRENT_ACTOR],
            }),
            makeTask({
                id: "t-someone-else",
                task_key: "FAC-3",
                title: "Triagem de outra pessoa",
                status: "TRIAGEM",
                collaborators: [SOMEONE_ELSE],
            }),
            makeTask({
                id: "t-wrong-status",
                task_key: "FAC-4",
                title: "Review Humano sem colaborador",
                status: "REVIEW_HUMANO",
                collaborators: [],
            }),
        ]);

        renderMyQueue();

        await screen.findByText("Triagem sem colaborador");
        expect(screen.getByText("Triagem minha")).toBeInTheDocument();
        expect(screen.queryByText("Triagem de outra pessoa")).not.toBeInTheDocument();
        expect(screen.queryByText("Review Humano sem colaborador")).not.toBeInTheDocument();
    });

    it("atualiza ao vivo quando um item relevante entra na fila via WebSocket", async () => {
        setTokens(VALID_ACCESS_TOKEN, "refresh-token-value");
        resetTasks([
            makeTask({
                id: "t-backlog",
                task_key: "FAC-5",
                title: "Ainda no Backlog",
                status: "BACKLOG",
                collaborators: [],
            }),
        ]);

        const { queryClient } = renderMyQueue();

        await screen.findByText("Minhas Tarefas / Fila de Avaliação");
        expect(screen.queryByText("Ainda no Backlog")).not.toBeInTheDocument();

        // The item moves into Triagem "from outside" (another user/agent via the API).
        resetTasks([
            makeTask({
                id: "t-backlog",
                task_key: "FAC-5",
                title: "Ainda no Backlog",
                status: "TRIAGEM",
                collaborators: [],
            }),
        ]);

        const fakeSocket = createFakeSocket();
        const disconnect = connectRealtime(queryClient, () => fakeSocket);

        fakeSocket.onmessage?.(
            new MessageEvent("message", {
                data: JSON.stringify({
                    event: "status_transition",
                    task_id: "t-backlog",
                    from_status: "BACKLOG",
                    to_status: "TRIAGEM",
                    actor_id: "someone-else",
                }),
            })
        );

        await waitFor(() => {
            expect(screen.getByText("Ainda no Backlog")).toBeInTheDocument();
        });

        disconnect();
    });
});
