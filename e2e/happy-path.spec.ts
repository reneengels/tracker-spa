import { test, expect } from "@playwright/test";
import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { bootstrapAgent } from "./admin-setup";
import { connectMcpClient, callTool } from "./mcp-client";

// Ticket 15: the full 10-status Scrumban happy path — Triagem → Backlog →
// Fila → Em Progresso → Review Agêntico → Review Humano → QA → Pronto —
// combining real human actions (this Playwright browser, driving the real
// SPA) and real agent actions (a real MCP client, driving the real MCP
// server) against the real tracker-api + a real test Postgres. No mocks
// anywhere in this file — that's what src/tests/**/*.spec.tsx (msw-backed,
// fast, isolated) are for; this suite proves the two repos actually agree
// on the wire, end to end.

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "e2e-admin@factory.dev";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "e2e-password-123";
const API_URL = process.env.E2E_API_URL ?? "http://localhost:8000";
const MCP_URL = process.env.E2E_MCP_URL ?? "http://localhost:8001/mcp";

test.describe("Happy path: Triagem → Pronto", () => {
    let mcpClient: Client;
    let agentToken: string;

    test.beforeAll(async () => {
        const bootstrap = await bootstrapAgent(API_URL);
        agentToken = bootstrap.agentToken;
        mcpClient = await connectMcpClient(MCP_URL, agentToken);
    });

    test.afterAll(async () => {
        await mcpClient?.close();
    });

    test("a task travels the full flow via real SPA + real MCP calls", async ({ page }) => {
        const taskTitle = `E2E happy path ${Date.now()}`;

        // --- Human via SPA: log in ---
        await page.goto("/login");
        await page.getByLabel(/e-mail/i).fill(ADMIN_EMAIL);
        await page.getByLabel(/senha/i).fill(ADMIN_PASSWORD);
        await page.getByRole("button", { name: /entrar/i }).click();
        await expect(page.getByRole("heading", { name: "Board Kanban" })).toBeVisible();

        // --- Human via SPA: create the task (lands in Triagem) ---
        await page.getByRole("button", { name: "Nova tarefa" }).click();
        await page.getByLabel("Título").fill(taskTitle);
        await page.getByLabel("Descrição").fill("Criada pelo teste E2E do caminho feliz.");
        await page.getByRole("button", { name: "Criar" }).click();

        const card = page.getByRole("region", { name: "Triagem" }).getByRole("article", { name: taskTitle });
        await expect(card).toBeVisible();
        await card.getByRole("link").click();
        await expect(page).toHaveURL(/\/tasks\/.+/);
        const taskId = page.url().split("/tasks/")[1];
        expect(taskId).toBeTruthy();

        // --- Human via SPA: Triagem → Backlog, via the suggested-next shortcut ---
        await expect(page.getByText("Atual: Triagem")).toBeVisible();
        await page.getByRole("button", { name: "Avançar para Backlog" }).click();
        await expect(page.getByText("Atual: Backlog")).toBeVisible();

        // --- Human via SPA: Backlog → Fila ---
        await page.getByRole("button", { name: "Avançar para Fila" }).click();
        await expect(page.getByText("Atual: Fila")).toBeVisible();

        // --- Agent via real MCP: claim (Fila → Em Progresso, joins as collaborator) ---
        const claimed = await callTool<{ status: string }>(mcpClient, "claim_task", { task_id: taskId });
        expect(claimed.status).toBe("EM_PROGRESSO");

        // --- Agent via real MCP: comment on progress ---
        await callTool(mcpClient, "add_comment", {
            task_id: taskId,
            body: "Implementação concluída, abrindo PR.",
        });

        // --- Agent via real MCP: attach a code artifact ---
        const artifact = await callTool<{ kind: string }>(mcpClient, "attach_code_artifact", {
            task_id: taskId,
            kind: "PR",
            url: "https://github.com/example/factory/pull/42",
            label: "Fix: happy path e2e",
        });
        expect(artifact.kind).toBe("PR");

        // --- Agent via real MCP: move to Review Agêntico ---
        const toReview = await callTool<{ status: string }>(mcpClient, "move_status", {
            task_id: taskId,
            to_status: "REVIEW_AGENTICO",
        });
        expect(toReview.status).toBe("REVIEW_AGENTICO");

        // --- Agent via real MCP: approve its own review, moves to Review Humano ---
        const toHumanReview = await callTool<{ status: string }>(mcpClient, "move_status", {
            task_id: taskId,
            to_status: "REVIEW_HUMANO",
        });
        expect(toHumanReview.status).toBe("REVIEW_HUMANO");

        // --- Human via SPA: reflect the agent-driven change, then approve Review Humano → QA ---
        await page.reload();
        await expect(page.getByText("Atual: Review Humano")).toBeVisible();
        // Comments/artifacts the agent added are visible in the same Detail screen.
        await expect(page.getByText("Implementação concluída, abrindo PR.")).toBeVisible();
        await page.getByRole("button", { name: "Avançar para QA" }).click();
        await expect(page.getByText("Atual: QA")).toBeVisible();

        // --- Human via SPA: approve QA → Pronto ---
        await page.getByRole("button", { name: "Avançar para Pronto" }).click();
        await expect(page.getByText("Atual: Pronto")).toBeVisible();

        // --- Final assertion: the task is Pronto, visible in the SPA ---
        await page.reload();
        await expect(page.getByText("Atual: Pronto")).toBeVisible();
    });
});
