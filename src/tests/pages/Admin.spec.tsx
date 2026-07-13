import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import { resetAdminStores, ADMIN_ACCESS_TOKEN, VALID_ACCESS_TOKEN } from "../mocks/handlers";
import { setTokens } from "@/lib/tokenStorage";
import { AuthProvider } from "@/lib/auth";
import RequireRole from "@/components/RequireRole";
import AdminUsers from "@/pages/admin/AdminUsers";
import AdminLabels from "@/pages/admin/AdminLabels";
import AdminWipLimits from "@/pages/admin/AdminWipLimits";
import AdminAgentTokens from "@/pages/admin/AdminAgentTokens";
import AdminNotifications from "@/pages/admin/AdminNotifications";

function renderAdminPage(page: React.ReactNode) {
    const queryClient = new QueryClient();
    return render(
        <QueryClientProvider client={queryClient}>
            <MemoryRouter>
                <AuthProvider>{page}</AuthProvider>
            </MemoryRouter>
        </QueryClientProvider>
    );
}

describe("Admin screens", () => {
    beforeEach(() => {
        resetAdminStores();
    });

    it("Usuários: cria um novo usuário e ele aparece na lista", async () => {
        setTokens(ADMIN_ACCESS_TOKEN, "refresh-token-value");
        renderAdminPage(<AdminUsers />);
        const user = userEvent.setup();

        await screen.findByText("Admin User");

        await user.type(screen.getByLabelText("Nome"), "Nova Dev");
        await user.type(screen.getByLabelText("Senha"), "senha-forte");
        await user.click(screen.getByRole("button", { name: "Criar usuário" }));

        await waitFor(() => {
            expect(screen.getByText("Nova Dev")).toBeInTheDocument();
        });
    });

    it("Labels: cria uma label e edita o nome", async () => {
        setTokens(ADMIN_ACCESS_TOKEN, "refresh-token-value");
        renderAdminPage(<AdminLabels />);
        const user = userEvent.setup();

        await user.type(screen.getByLabelText("Nome"), "Time A");
        await user.type(screen.getByLabelText("Dimensão"), "Time");
        await user.click(screen.getByRole("button", { name: "Criar label" }));

        await screen.findByText("Time A");

        await user.click(screen.getByRole("button", { name: "Editar" }));
        const editInput = screen.getByLabelText("Editar nome de Time A");
        await user.clear(editInput);
        await user.type(editInput, "Time B");
        await user.click(screen.getByRole("button", { name: "Salvar" }));

        await waitFor(() => {
            expect(screen.getByText("Time B")).toBeInTheDocument();
        });
    });

    it("WIP Limits: define um limite para um status e persiste", async () => {
        setTokens(ADMIN_ACCESS_TOKEN, "refresh-token-value");
        renderAdminPage(<AdminWipLimits />);
        const user = userEvent.setup();

        const input = await screen.findByLabelText("Limite de WIP para Review Humano");
        await user.type(input, "3");

        const row = input.closest("tr");
        if (!row) throw new Error("row not found");
        await user.click(within(row).getByRole("button", { name: "Salvar" }));

        await waitFor(async () => {
            const refreshedInput = await screen.findByLabelText("Limite de WIP para Review Humano");
            expect((refreshedInput as HTMLInputElement).value).toBe("3");
        });
    });

    it("Tokens de Agente: cria um token para um agente, mostra o segredo uma vez, e revoga", async () => {
        setTokens(ADMIN_ACCESS_TOKEN, "refresh-token-value");
        renderAdminPage(<AdminUsers />);
        const user = userEvent.setup();
        await user.type(screen.getByLabelText("Nome"), "Agente Um");
        await user.selectOptions(screen.getByLabelText("Tipo"), "ai_agent");
        await user.click(screen.getByRole("button", { name: "Criar usuário" }));
        await screen.findByText("Agente Um");

        renderAdminPage(<AdminAgentTokens />);

        await screen.findByRole("option", { name: "Agente Um" });
        const select = screen.getByLabelText("Agente");
        await user.selectOptions(select, "Agente Um");
        await user.click(screen.getByLabelText("list_backlog"));
        await user.click(screen.getByRole("button", { name: "Criar token" }));

        await screen.findByText("Copie este token agora — ele não será mostrado novamente.");
        expect(screen.getByText(/raw-secret-/)).toBeInTheDocument();

        await waitFor(() => {
            expect(screen.getByRole("button", { name: "Revogar" })).toBeInTheDocument();
        });
        await user.click(screen.getByRole("button", { name: "Revogar" }));

        await waitFor(() => {
            expect(screen.queryByRole("button", { name: "Revogar" })).not.toBeInTheDocument();
        });
    });

    it("Notificações: edita a configuração de webhook e persiste", async () => {
        setTokens(ADMIN_ACCESS_TOKEN, "refresh-token-value");
        renderAdminPage(<AdminNotifications />);
        const user = userEvent.setup();

        const urlInput = await screen.findByLabelText("URL do webhook");
        await user.type(urlInput, "https://hooks.slack.com/services/T00/B00/xyz");
        await user.click(screen.getByLabelText("Notificações Slack/Teams ativadas"));
        await user.type(screen.getByLabelText("Limite da Fila para notificar reabastecimento"), "5");
        await user.click(screen.getByLabelText("Permitir saída de rede (desligue para ambientes air-gapped)"));

        await user.click(screen.getByRole("button", { name: "Salvar" }));

        await waitFor(async () => {
            const refreshedUrl = await screen.findByLabelText("URL do webhook");
            expect((refreshedUrl as HTMLInputElement).value).toBe(
                "https://hooks.slack.com/services/T00/B00/xyz"
            );
            expect(
                (screen.getByLabelText("Notificações Slack/Teams ativadas") as HTMLInputElement).checked
            ).toBe(true);
            expect(
                (screen.getByLabelText("Limite da Fila para notificar reabastecimento") as HTMLInputElement)
                    .value
            ).toBe("5");
            expect(
                (
                    screen.getByLabelText(
                        "Permitir saída de rede (desligue para ambientes air-gapped)"
                    ) as HTMLInputElement
                ).checked
            ).toBe(false);
        });
    });

    it("Notificações: usuário não-Admin não consegue acessar a tela", async () => {
        setTokens(VALID_ACCESS_TOKEN, "refresh-token-value");
        renderAdminPage(
            <RequireRole role="Admin">
                <AdminNotifications />
            </RequireRole>
        );

        await screen.findByRole("alert");
        expect(screen.queryByLabelText("URL do webhook")).not.toBeInTheDocument();
    });

    it("RequireRole bloqueia um usuário não-Admin", async () => {
        setTokens(VALID_ACCESS_TOKEN, "refresh-token-value");
        renderAdminPage(
            <RequireRole role="Admin">
                <div>Conteúdo restrito</div>
            </RequireRole>
        );

        await screen.findByRole("alert");
        expect(screen.queryByText("Conteúdo restrito")).not.toBeInTheDocument();
    });

    it("RequireRole permite acesso a um usuário Admin", async () => {
        setTokens(ADMIN_ACCESS_TOKEN, "refresh-token-value");
        renderAdminPage(
            <RequireRole role="Admin">
                <div>Conteúdo restrito</div>
            </RequireRole>
        );

        await screen.findByText("Conteúdo restrito");
    });
});
