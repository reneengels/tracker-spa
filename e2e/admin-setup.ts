// Ticket 15: real HTTP calls (not the SPA) against tracker-api's Admin API
// to bootstrap the AI agent Actor + its MCP token, using the seeded human's
// credentials (see seed_admin.py) — this is the same path a real Admin
// would use via the Admin screens (ticket 12), just driven directly.

interface Envelope<T> {
    success: boolean;
    message: string;
    data: T;
}

async function postJson<T>(url: string, token: string | null, body: unknown): Promise<T> {
    // `Connection: close` works around a spurious
    // RequestContentLengthMismatchError from undici's keep-alive handling
    // against this dev-mode Uvicorn server (reproduced in this sandbox) —
    // forcing a fresh connection per request sidesteps it; performance is
    // irrelevant for this handful of one-time setup calls.
    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Connection: "close",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
    });
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`POST ${url} -> ${response.status}: ${text}`);
    }
    const envelope = (await response.json()) as Envelope<T>;
    return envelope.data;
}

export interface AgentBootstrap {
    adminToken: string;
    agentToken: string;
}

/**
 * Log in as the seeded bootstrap Admin, create an `ai_agent` Actor, and
 * mint a real MCP token for it with the scope the happy-path test needs.
 */
export async function bootstrapAgent(apiUrl: string): Promise<AgentBootstrap> {
    const adminEmail = process.env.E2E_ADMIN_EMAIL ?? "e2e-admin@factory.dev";
    const adminPassword = process.env.E2E_ADMIN_PASSWORD ?? "e2e-password-123";

    const login = await postJson<{ access_token: string }>(`${apiUrl}/auth/login`, null, {
        email: adminEmail,
        password: adminPassword,
    });
    const adminToken = login.access_token;

    const agentActor = await postJson<{ id: string }>(`${apiUrl}/admin/users`, adminToken, {
        name: "E2E Dev Agent",
        type: "ai_agent",
        role: "AI_Agent",
    });

    const mintedToken = await postJson<{ token: string }>(`${apiUrl}/admin/agent-tokens`, adminToken, {
        actor_id: agentActor.id,
        scope: ["claim_task", "add_comment", "attach_code_artifact", "move_status"],
    });

    return { adminToken, agentToken: mintedToken.token };
}
