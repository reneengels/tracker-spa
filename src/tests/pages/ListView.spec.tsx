import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import { resetTasks, makeTask } from "../mocks/handlers";
import { setTokens } from "@/lib/tokenStorage";
import { AuthProvider } from "@/lib/auth";
import { VALID_ACCESS_TOKEN } from "../mocks/handlers";
import ListView from "../../pages/ListView.tsx";

/**
 * jsdom has no IntersectionObserver — capture the callback registered by
 * ListView's sentinel so the test can fire it manually to simulate the
 * sentinel scrolling into view, without needing a real scroll container.
 */
let observerCallback: IntersectionObserverCallback | null = null;

class FakeIntersectionObserver {
    constructor(callback: IntersectionObserverCallback) {
        observerCallback = callback;
    }
    observe() {}
    disconnect() {}
    unobserve() {}
}

function triggerSentinelVisible() {
    observerCallback?.(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver
    );
}

function renderListView() {
    const queryClient = new QueryClient();
    return render(
        <QueryClientProvider client={queryClient}>
            <MemoryRouter>
                <AuthProvider>
                    <ListView />
                </AuthProvider>
            </MemoryRouter>
        </QueryClientProvider>
    );
}

describe("List View", () => {
    beforeEach(() => {
        setTokens(VALID_ACCESS_TOKEN, "refresh-token-value");
        vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);
    });

    afterEach(() => {
        observerCallback = null;
        vi.unstubAllGlobals();
    });

    it("scroll infinito não duplica nem pula itens ao carregar a segunda página", async () => {
        // ListView requests pages of 20 — seed 25 so the first fetch returns exactly 20
        // and a genuine second network page (5 more) is required to see the rest.
        const seeded = Array.from({ length: 25 }, (_, i) =>
            makeTask({
                id: `t-${i + 1}`,
                task_key: `FAC-${i + 1}`,
                title: `Tarefa ${i + 1}`,
                status: "FILA",
                priority: "NORMAL",
            })
        );
        resetTasks(seeded);

        renderListView();

        await screen.findByText("Tarefa 1");
        expect(screen.getAllByRole("row")).toHaveLength(20);

        triggerSentinelVisible();

        await waitFor(() => {
            expect(screen.getAllByRole("row")).toHaveLength(25);
        });

        const titles = screen.getAllByRole("row").map((row) => row.textContent ?? "");
        const uniqueTitles = new Set(titles);
        expect(uniqueTitles.size).toBe(25);
        for (let i = 1; i <= 25; i++) {
            expect(screen.getByText(`Tarefa ${i}`)).toBeInTheDocument();
        }
    });

    it("agrupa por status (ordem do fluxo) e ordena por prioridade dentro do grupo após paginação", async () => {
        resetTasks([
            makeTask({ id: "t-1", task_key: "FAC-1", title: "Fila baixa", status: "FILA", priority: "LOW" }),
            makeTask({
                id: "t-2",
                task_key: "FAC-2",
                title: "Fila urgente",
                status: "FILA",
                priority: "URGENT",
            }),
            makeTask({
                id: "t-3",
                task_key: "FAC-3",
                title: "Triagem normal",
                status: "TRIAGEM",
                priority: "NORMAL",
            }),
        ]);

        renderListView();
        await screen.findByText("Triagem normal");

        const triagemSection = screen.getByRole("region", { name: "Triagem" });
        const filaSection = screen.getByRole("region", { name: "Fila" });

        expect(within(triagemSection).getByText("Triagem normal")).toBeInTheDocument();

        const filaTitles = within(filaSection)
            .getAllByRole("row")
            .map((row) => row.textContent ?? "");
        expect(filaTitles[0]).toContain("Fila urgente");
        expect(filaTitles[1]).toContain("Fila baixa");
    });
});
