import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/lib/auth";
import App from "../../App.tsx";

function renderApp() {
    const queryClient = new QueryClient();
    return render(
        <QueryClientProvider client={queryClient}>
            <AuthProvider>
                <MemoryRouter initialEntries={["/login"]}>
                    <App />
                </MemoryRouter>
            </AuthProvider>
        </QueryClientProvider>
    );
}

const BOARD_COLUMNS = [
    "Triagem",
    "Backlog",
    "Fila",
    "Rework",
    "Em Progresso",
    "Review Agêntico",
    "Review Humano",
    "QA",
    "Pronto",
    "Rejeitado/Cancelado",
];

describe("Login flow", () => {
    it("navigates to the Board and renders all 10 empty columns after a successful login", async () => {
        const user = userEvent.setup();
        renderApp();

        await user.type(screen.getByLabelText(/e-mail/i), "po@factory.dev");
        await user.type(screen.getByLabelText(/senha/i), "correct-horse");
        await user.click(screen.getByRole("button", { name: /entrar/i }));

        await waitFor(() => {
            expect(screen.getByText("Board Kanban")).toBeInTheDocument();
        });

        for (const column of BOARD_COLUMNS) {
            expect(screen.getByRole("heading", { name: column, level: 2 })).toBeInTheDocument();
        }
    });

    it("rejects an invalid login and stays on the login screen", async () => {
        const user = userEvent.setup();
        renderApp();

        await user.type(screen.getByLabelText(/e-mail/i), "po@factory.dev");
        await user.type(screen.getByLabelText(/senha/i), "wrong-password");
        await user.click(screen.getByRole("button", { name: /entrar/i }));

        expect(await screen.findByRole("alert")).toHaveTextContent(/inválidos/i);
        expect(screen.queryByText("Board Kanban")).not.toBeInTheDocument();
    });

    it("redirects an unauthenticated visit to /board back to /login", () => {
        render(
            <QueryClientProvider client={new QueryClient()}>
                <AuthProvider>
                    <MemoryRouter initialEntries={["/board"]}>
                        <App />
                    </MemoryRouter>
                </AuthProvider>
            </QueryClientProvider>
        );

        expect(screen.getByRole("heading", { name: "Factory" })).toBeInTheDocument();
    });
});
