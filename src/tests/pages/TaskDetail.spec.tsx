import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { AuthProvider } from "@/lib/auth";
import { setTokens } from "@/lib/tokenStorage";
import { resetTasks, makeTask, VALID_ACCESS_TOKEN } from "../mocks/handlers";
import App from "../../App.tsx";

function logInAsMockActor() {
    setTokens(VALID_ACCESS_TOKEN, "refresh-token-value");
}

function renderDetail(taskId: string) {
    const queryClient = new QueryClient();
    return render(
        <QueryClientProvider client={queryClient}>
            <AuthProvider>
                <MemoryRouter initialEntries={[`/tasks/${taskId}`]}>
                    <Toaster />
                    <App />
                </MemoryRouter>
            </AuthProvider>
        </QueryClientProvider>
    );
}

describe("Task Detail", () => {
    it("edits a field and saves, reflecting the new value", async () => {
        resetTasks([
            makeTask({ id: "task-1", task_key: "FAC-1", title: "Título antigo", status: "TRIAGEM" }),
        ]);
        logInAsMockActor();
        const user = userEvent.setup();
        renderDetail("task-1");

        const titleInput = await screen.findByLabelText("Título");
        await user.clear(titleInput);
        await user.type(titleInput, "Título novo");
        await user.click(screen.getByRole("button", { name: "Salvar" }));

        await waitFor(() => {
            expect(screen.getByRole("heading", { name: /Título novo/ })).toBeInTheDocument();
        });
    });

    it("changes status via the selector without requiring a comment", async () => {
        resetTasks([
            makeTask({ id: "task-1", task_key: "FAC-1", title: "Escrever specs", status: "TRIAGEM" }),
        ]);
        logInAsMockActor();
        const user = userEvent.setup();
        renderDetail("task-1");

        await screen.findByText("Atual: Triagem");

        await user.selectOptions(screen.getByLabelText("Mover para"), "BACKLOG");
        await user.click(screen.getByRole("button", { name: "Mudar status" }));

        await waitFor(() => {
            expect(screen.getByText("Atual: Backlog")).toBeInTheDocument();
        });
    });

    it("moves to the next status via the suggested shortcut", async () => {
        resetTasks([
            makeTask({ id: "task-1", task_key: "FAC-1", title: "Escrever specs", status: "TRIAGEM" }),
        ]);
        logInAsMockActor();
        const user = userEvent.setup();
        renderDetail("task-1");

        const shortcut = await screen.findByRole("button", { name: "Avançar para Backlog" });
        await user.click(shortcut);

        await waitFor(() => {
            expect(screen.getByText("Atual: Backlog")).toBeInTheDocument();
        });
    });

    it("adds and removes a blocking task without changing status or version", async () => {
        resetTasks([
            makeTask({ id: "task-1", task_key: "FAC-1", title: "Tarefa bloqueada", status: "TRIAGEM" }),
            makeTask({ id: "task-2", task_key: "FAC-2", title: "Tarefa bloqueadora", status: "BACKLOG" }),
        ]);
        logInAsMockActor();
        const user = userEvent.setup();
        renderDetail("task-1");

        await screen.findByText("Atual: Triagem");

        await user.type(screen.getByLabelText("Adicionar tarefa bloqueadora"), "FAC-2");
        const match = await screen.findByRole("button", { name: /FAC-2 · Tarefa bloqueadora/ });
        await user.click(match);

        expect(await screen.findByText(/FAC-2 · Tarefa bloqueadora \(Backlog\)/)).toBeInTheDocument();
        expect(screen.getByText("Atual: Triagem")).toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: "Remover bloqueio FAC-2" }));

        await waitFor(() => {
            expect(screen.queryByText(/FAC-2 · Tarefa bloqueadora/)).not.toBeInTheDocument();
        });
        expect(screen.getByText("Atual: Triagem")).toBeInTheDocument();
    });
});
