import { describe, it, expect } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import { Toaster } from "sonner";
import { resetTasks, makeTask } from "../mocks/handlers";
import { AuthProvider } from "@/lib/auth";
import { connectRealtime } from "@/lib/realtime";
import Board from "../../pages/Board.tsx";

function renderBoardWithClient() {
    const queryClient = new QueryClient();
    const result = render(
        <QueryClientProvider client={queryClient}>
            <MemoryRouter>
                <AuthProvider>
                    <Toaster />
                    <Board />
                </AuthProvider>
            </MemoryRouter>
        </QueryClientProvider>
    );
    return { ...result, queryClient };
}

/** A minimal WebSocket stand-in — just enough surface for connectRealtime to attach handlers to. */
function createFakeSocket() {
    return {
        onmessage: null as ((event: MessageEvent) => void) | null,
        onclose: null as (() => void) | null,
        close: () => {
            /* no-op */
        },
    } as unknown as WebSocket;
}

describe("Realtime updates", () => {
    it("updates a Board card when a status transition arrives via WebSocket, without any client-initiated refetch", async () => {
        resetTasks([
            makeTask({ id: "task-1", task_key: "FAC-1", title: "Escrever specs", status: "TRIAGEM" }),
        ]);
        const { queryClient } = renderBoardWithClient();

        await screen.findByRole("article", { name: "Escrever specs" });
        expect(
            within(screen.getByRole("region", { name: "Triagem" })).getByText("FAC-1")
        ).toBeInTheDocument();

        // Simulate the change happening "from outside" this client (another user, via the API) —
        // the mock backend now reports the task as already moved.
        resetTasks([
            makeTask({ id: "task-1", task_key: "FAC-1", title: "Escrever specs", status: "BACKLOG" }),
        ]);

        const fakeSocket = createFakeSocket();
        const disconnect = connectRealtime(queryClient, () => fakeSocket);

        fakeSocket.onmessage?.(
            new MessageEvent("message", {
                data: JSON.stringify({
                    event: "status_transition",
                    task_id: "task-1",
                    from_status: "TRIAGEM",
                    to_status: "BACKLOG",
                    actor_id: "someone-else",
                }),
            })
        );

        await waitFor(() => {
            expect(
                within(screen.getByRole("region", { name: "Backlog" })).getByText("FAC-1")
            ).toBeInTheDocument();
        });
        expect(
            within(screen.getByRole("region", { name: "Triagem" })).queryByText("FAC-1")
        ).not.toBeInTheDocument();

        disconnect();
    });
});
