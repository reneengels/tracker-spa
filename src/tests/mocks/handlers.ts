import { http, HttpResponse, ws } from "msw";
import type {
    AdminUser,
    AgentTokenEntry,
    Label,
    NotificationConfig,
    StatusTransitionEntry,
    Task,
    TaskComment,
    TaskDetail,
    WorkflowConfigEntry,
} from "@/lib/api";
import type { TaskStatus } from "@/lib/taskStatus";
import { BOARD_COLUMNS } from "@/lib/taskStatus";

const PRIORITY_ORDER: Record<Task["priority"], number> = {
    URGENT: 0,
    HIGH: 1,
    NORMAL: 2,
    LOW: 3,
};

export const VALID_ACCESS_TOKEN =
    "eyJhbGciOiAiSFMyNTYiLCAidHlwIjogIkpXVCJ9." +
    "eyJzdWIiOiAicG8tdXNlciIsICJyb2xlIjogIlBPIn0." +
    "test-signature";

/** The actor id encoded in `VALID_ACCESS_TOKEN`'s `sub` claim — join/leave mocks act as this user. */
export const MOCK_CURRENT_ACTOR = { id: "po-user", name: "PO User", type: "human" as const };

/** A second mock JWT with an Admin role claim, for ticket 12's RBAC tests. */
export const ADMIN_ACCESS_TOKEN =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9." +
    "eyJzdWIiOiJhZG1pbi11c2VyIiwicm9sZSI6IkFkbWluIn0." +
    "test-signature";

/** Mirrors TransitionService's flow graph (tracker-api) for mock validation. */
const TRANSITION_GRAPH: Record<TaskStatus, TaskStatus[]> = {
    TRIAGEM: ["BACKLOG", "REJEITADO_CANCELADO"],
    BACKLOG: ["FILA", "REJEITADO_CANCELADO"],
    FILA: ["EM_PROGRESSO"],
    REWORK: ["EM_PROGRESSO"],
    EM_PROGRESSO: ["REVIEW_AGENTICO"],
    REVIEW_AGENTICO: ["REVIEW_HUMANO", "EM_PROGRESSO"],
    REVIEW_HUMANO: ["QA", "REWORK"],
    QA: ["PRONTO", "REWORK"],
    PRONTO: [],
    REJEITADO_CANCELADO: [],
};

/** Mirrors TransitionService's "primary forward edge" suggestion for the next-status shortcut. */
const SUGGESTED_NEXT: Partial<Record<TaskStatus, TaskStatus>> = {
    TRIAGEM: "BACKLOG",
    BACKLOG: "FILA",
    FILA: "EM_PROGRESSO",
    REWORK: "EM_PROGRESSO",
    EM_PROGRESSO: "REVIEW_AGENTICO",
    REVIEW_AGENTICO: "REVIEW_HUMANO",
    REVIEW_HUMANO: "QA",
    QA: "PRONTO",
};

let tasks: Task[] = [];
let nextSequence = 1;
let commentsByTask: Record<string, TaskComment[]> = {};
let transitionsByTask: Record<string, StatusTransitionEntry[]> = {};
let nextCommentId = 1;
let nextTransitionId = 1;

let users: AdminUser[] = [
    { id: "po-user", name: "PO User", email: null, type: "human", role: "PO", active: true },
    { id: "admin-user", name: "Admin User", email: null, type: "human", role: "Admin", active: true },
];
let nextUserId = 1;
let mockLabels: Label[] = [];
let nextLabelId = 1;
let workflowConfig: WorkflowConfigEntry[] = BOARD_COLUMNS.map(({ status }) => ({
    status,
    wip_limit: null,
}));
let agentTokens: AgentTokenEntry[] = [];
let nextAgentTokenId = 1;
let notificationConfig: NotificationConfig = {
    webhook_url: null,
    webhook_enabled: false,
    queue_low_threshold: null,
    network_egress_enabled: true,
};

/** Resets the in-memory admin mock stores; call between tests to avoid leakage. */
export function resetAdminStores(): void {
    users = [
        { id: "po-user", name: "PO User", email: null, type: "human", role: "PO", active: true },
        { id: "admin-user", name: "Admin User", email: null, type: "human", role: "Admin", active: true },
    ];
    nextUserId = 1;
    mockLabels = [];
    nextLabelId = 1;
    workflowConfig = BOARD_COLUMNS.map(({ status }) => ({ status, wip_limit: null }));
    agentTokens = [];
    nextAgentTokenId = 1;
    notificationConfig = {
        webhook_url: null,
        webhook_enabled: false,
        queue_low_threshold: null,
        network_egress_enabled: true,
    };
}

/** Resets the in-memory mock task store; call between tests to avoid leakage. */
export function resetTasks(seed: Task[] = []): void {
    tasks = seed.map((task) => ({ ...task }));
    nextSequence = tasks.length + 1;
    commentsByTask = {};
    transitionsByTask = {};
    nextCommentId = 1;
    nextTransitionId = 1;
}

function toDetail(task: Task): TaskDetail {
    return {
        ...task,
        comments: commentsByTask[task.id] ?? [],
        transitions: transitionsByTask[task.id] ?? [],
        code_artifacts: [],
    };
}

export function makeTask(overrides: Partial<Task> = {}): Task {
    const sequence = nextSequence++;
    return {
        id: overrides.id ?? `task-${sequence}`,
        task_key: overrides.task_key ?? `FAC-${sequence}`,
        title: overrides.title ?? `Tarefa ${sequence}`,
        description: overrides.description ?? "",
        status: overrides.status ?? "TRIAGEM",
        priority: overrides.priority ?? "NORMAL",
        due_date: overrides.due_date ?? null,
        estimate_value: overrides.estimate_value ?? null,
        estimate_unit: overrides.estimate_unit ?? null,
        type: overrides.type ?? "FEATURE",
        rework_origin_stage: overrides.rework_origin_stage ?? null,
        last_return_reason: overrides.last_return_reason ?? null,
        return_count: overrides.return_count ?? 0,
        tags: overrides.tags ?? null,
        demand_source: overrides.demand_source ?? "PO",
        parent_task_id: overrides.parent_task_id ?? null,
        version: overrides.version ?? 1,
        created_at: overrides.created_at ?? new Date(0).toISOString(),
        updated_at: overrides.updated_at ?? new Date(0).toISOString(),
        collaborators: overrides.collaborators ?? [],
        blocked_by: overrides.blocked_by ?? [],
        labels: overrides.labels ?? [],
    };
}

export const PROJETO_LABEL: Label = {
    id: "label-projeto-factory",
    name: "Factory",
    dimension: "Projeto/Epico",
    color: "#0ea5e9",
};

export const handlers = [
    http.post("http://localhost:8000/auth/login", async ({ request }) => {
        const body = (await request.json()) as { username: string; password: string };

        if (body.username === "po" && body.password === "correct-horse") {
            return HttpResponse.json({
                success: true,
                message: "Login successful",
                data: {
                    access_token: VALID_ACCESS_TOKEN,
                    refresh_token: "refresh-token-value",
                    token_type: "bearer",
                },
            });
        }

        return new HttpResponse(null, { status: 401 });
    }),

    http.get("http://localhost:8000/tasks", () => {
        return HttpResponse.json({ success: true, message: "OK", data: tasks });
    }),

    http.get("http://localhost:8000/tasks/search", ({ request }) => {
        const url = new URL(request.url);
        const collaboratorIds = url.searchParams.getAll("collaborator_id");
        const priorities = url.searchParams.getAll("priority");
        const type = url.searchParams.get("type");
        const labelIds = url.searchParams.getAll("label_id");
        const projectEpicoId = url.searchParams.get("project_epico_label_id");
        const tags = url.searchParams.getAll("tags");
        const q = url.searchParams.get("q")?.toLowerCase() ?? null;
        const cursor = url.searchParams.get("cursor");
        const limit = Number(url.searchParams.get("limit") ?? "30");
        const myQueue = url.searchParams.get("my_queue") === "true";

        let filtered = tasks.filter((task) => {
            if (collaboratorIds.length > 0) {
                const matchesUnassigned =
                    collaboratorIds.includes("unassigned") && task.collaborators.length === 0;
                const matchesActor = task.collaborators.some((c) => collaboratorIds.includes(c.id));
                if (!matchesUnassigned && !matchesActor) return false;
            }
            if (priorities.length > 0 && !priorities.includes(task.priority)) return false;
            if (type && task.type !== type) return false;
            if (labelIds.length > 0 && !task.labels.some((l) => labelIds.includes(l.id))) return false;
            if (projectEpicoId && !task.labels.some((l) => l.id === projectEpicoId)) return false;
            if (tags.length > 0 && !(task.tags ?? []).some((tag) => tags.includes(tag))) return false;
            if (
                q &&
                !task.title.toLowerCase().includes(q) &&
                !task.description.toLowerCase().includes(q) &&
                !task.task_key.toLowerCase().includes(q)
            ) {
                return false;
            }
            if (myQueue) {
                // Mirrors the backend's role→status relevance rule (ticket 11): the mock
                // current actor's role is "PO" (VALID_ACCESS_TOKEN's role claim), compatible
                // with TRIAGEM. Combined with "collaborator OR unassigned" (ticket 09/04 model).
                const roleCompatibleStatuses: Task["status"][] = ["TRIAGEM"];
                if (!roleCompatibleStatuses.includes(task.status)) return false;
                const isCollaborator = task.collaborators.some((c) => c.id === MOCK_CURRENT_ACTOR.id);
                const isUnassigned = task.collaborators.length === 0;
                if (!isCollaborator && !isUnassigned) return false;
            }
            return true;
        });

        // Flat, globally priority-ordered stream — client groups by status itself.
        filtered = [...filtered].sort(
            (a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || a.id.localeCompare(b.id)
        );

        // Keyset pagination by id (found fresh on every request, not by offset) — an
        // insert anywhere in `tasks` between two page fetches never duplicates or
        // skips items already returned, since the cursor is a stable identity, not a position.
        let startIndex = 0;
        if (cursor) {
            const idx = filtered.findIndex((task) => task.id === cursor);
            startIndex = idx === -1 ? 0 : idx + 1;
        }
        const page = filtered.slice(startIndex, startIndex + limit);
        const nextCursor =
            startIndex + limit < filtered.length ? (page[page.length - 1]?.id ?? null) : null;

        return HttpResponse.json({
            success: true,
            message: "OK",
            data: { tasks: page, next_cursor: nextCursor },
        });
    }),

    http.get("http://localhost:8000/tasks/:id", ({ params }) => {
        const task = tasks.find((candidate) => candidate.id === params.id);
        if (!task) {
            return new HttpResponse(null, { status: 404 });
        }
        return HttpResponse.json({ success: true, message: "OK", data: toDetail(task) });
    }),

    http.patch("http://localhost:8000/tasks/:id", async ({ params, request }) => {
        const task = tasks.find((candidate) => candidate.id === params.id);
        if (!task) {
            return new HttpResponse(null, { status: 404 });
        }
        const body = (await request.json()) as Partial<Task> & { version: number };
        if (body.version !== task.version) {
            return HttpResponse.json(
                {
                    success: false,
                    error_code: "STALE_VERSION",
                    message: "Esta tarefa foi alterada por outra pessoa. Recarregue e tente novamente.",
                },
                { status: 409 }
            );
        }
        Object.assign(task, body, { version: task.version + 1 });
        return HttpResponse.json({ success: true, message: "Task updated", data: task });
    }),

    http.get("http://localhost:8000/tasks/:id/next-status", ({ params }) => {
        const task = tasks.find((candidate) => candidate.id === params.id);
        if (!task) {
            return new HttpResponse(null, { status: 404 });
        }
        return HttpResponse.json({
            success: true,
            message: "OK",
            data: {
                suggested: SUGGESTED_NEXT[task.status] ?? null,
                valid_transitions: TRANSITION_GRAPH[task.status],
            },
        });
    }),

    http.post("http://localhost:8000/tasks/:id/comments", async ({ params, request }) => {
        const task = tasks.find((candidate) => candidate.id === params.id);
        if (!task) {
            return new HttpResponse(null, { status: 404 });
        }
        const body = (await request.json()) as { body: string };
        const comment: TaskComment = {
            id: `comment-${nextCommentId++}`,
            body: body.body,
            author: MOCK_CURRENT_ACTOR,
            transition_id: null,
            created_at: new Date(0).toISOString(),
        };
        commentsByTask[task.id] = [...(commentsByTask[task.id] ?? []), comment];
        return HttpResponse.json(
            { success: true, message: "Comment added", data: comment },
            { status: 201 }
        );
    }),

    http.post("http://localhost:8000/tasks/:id/transitions", async ({ params, request }) => {
        const body = (await request.json()) as { to_status: Task["status"]; reason?: string };
        const task = tasks.find((candidate) => candidate.id === params.id);
        if (!task) {
            return new HttpResponse(null, { status: 404 });
        }
        if (!TRANSITION_GRAPH[task.status].includes(body.to_status)) {
            return HttpResponse.json(
                {
                    success: false,
                    error_code: "INVALID_TRANSITION",
                    message: `Não é possível mover de ${task.status} para ${body.to_status}.`,
                },
                { status: 409 }
            );
        }
        const transitionId = `transition-${nextTransitionId++}`;
        transitionsByTask[task.id] = [
            ...(transitionsByTask[task.id] ?? []),
            {
                id: transitionId,
                from_status: task.status,
                to_status: body.to_status,
                reason: body.reason ?? null,
                actor: MOCK_CURRENT_ACTOR,
                created_at: new Date(0).toISOString(),
            },
        ];
        if (body.reason) {
            commentsByTask[task.id] = [
                ...(commentsByTask[task.id] ?? []),
                {
                    id: `comment-${nextCommentId++}`,
                    body: body.reason,
                    author: MOCK_CURRENT_ACTOR,
                    transition_id: transitionId,
                    created_at: new Date(0).toISOString(),
                },
            ];
        }
        task.status = body.to_status;
        task.version += 1;
        return HttpResponse.json({ success: true, message: "Task transitioned", data: task });
    }),

    http.post("http://localhost:8000/tasks/:id/collaborators", ({ params }) => {
        const task = tasks.find((candidate) => candidate.id === params.id);
        if (!task) {
            return new HttpResponse(null, { status: 404 });
        }
        if (!task.collaborators.some((c) => c.id === MOCK_CURRENT_ACTOR.id)) {
            task.collaborators = [...task.collaborators, MOCK_CURRENT_ACTOR];
        }
        return HttpResponse.json({ success: true, message: "Joined task", data: task });
    }),

    http.delete("http://localhost:8000/tasks/:id/collaborators", ({ params }) => {
        const task = tasks.find((candidate) => candidate.id === params.id);
        if (!task) {
            return new HttpResponse(null, { status: 404 });
        }
        task.collaborators = task.collaborators.filter((c) => c.id !== MOCK_CURRENT_ACTOR.id);
        return HttpResponse.json({ success: true, message: "Left task", data: task });
    }),

    http.post("http://localhost:8000/tasks/:id/dependencies", async ({ params, request }) => {
        const task = tasks.find((candidate) => candidate.id === params.id);
        if (!task) {
            return new HttpResponse(null, { status: 404 });
        }
        const body = (await request.json()) as { depends_on_task_id: string };
        if (body.depends_on_task_id === task.id) {
            return new HttpResponse(null, { status: 422 });
        }
        const blocker = tasks.find((candidate) => candidate.id === body.depends_on_task_id);
        if (!blocker) {
            return new HttpResponse(null, { status: 404 });
        }
        if (!task.blocked_by.some((b) => b.id === blocker.id)) {
            task.blocked_by = [
                ...task.blocked_by,
                { id: blocker.id, task_key: blocker.task_key, title: blocker.title, status: blocker.status },
            ];
        }
        return HttpResponse.json({ success: true, message: "Dependency added", data: task });
    }),

    http.delete("http://localhost:8000/tasks/:id/dependencies/:blockerId", ({ params }) => {
        const task = tasks.find((candidate) => candidate.id === params.id);
        if (!task) {
            return new HttpResponse(null, { status: 404 });
        }
        task.blocked_by = task.blocked_by.filter((b) => b.id !== params.blockerId);
        return HttpResponse.json({ success: true, message: "Dependency removed", data: task });
    }),

    // --- Admin (ticket 12) ---

    http.get("http://localhost:8000/admin/users", ({ request }) => {
        if (!request.headers.get("Authorization")?.includes(ADMIN_ACCESS_TOKEN)) {
            return new HttpResponse(null, { status: 403 });
        }
        return HttpResponse.json({ success: true, message: "OK", data: users });
    }),

    http.post("http://localhost:8000/admin/users", async ({ request }) => {
        if (!request.headers.get("Authorization")?.includes(ADMIN_ACCESS_TOKEN)) {
            return new HttpResponse(null, { status: 403 });
        }
        const body = (await request.json()) as Partial<AdminUser> & { password?: string };
        const user: AdminUser = {
            id: `user-${nextUserId++}`,
            name: body.name ?? "",
            email: body.email ?? null,
            type: body.type ?? "human",
            role: body.role ?? "Dev",
            active: true,
        };
        users = [...users, user];
        return HttpResponse.json(
            { success: true, message: "User created", data: user },
            { status: 201 }
        );
    }),

    http.patch("http://localhost:8000/admin/users/:id", async ({ params, request }) => {
        if (!request.headers.get("Authorization")?.includes(ADMIN_ACCESS_TOKEN)) {
            return new HttpResponse(null, { status: 403 });
        }
        const user = users.find((candidate) => candidate.id === params.id);
        if (!user) {
            return new HttpResponse(null, { status: 404 });
        }
        const body = (await request.json()) as Partial<AdminUser>;
        Object.assign(user, body);
        return HttpResponse.json({ success: true, message: "User updated", data: user });
    }),

    http.get("http://localhost:8000/labels", () => {
        return HttpResponse.json({ success: true, message: "OK", data: mockLabels });
    }),

    http.post("http://localhost:8000/admin/labels", async ({ request }) => {
        if (!request.headers.get("Authorization")?.includes(ADMIN_ACCESS_TOKEN)) {
            return new HttpResponse(null, { status: 403 });
        }
        const body = (await request.json()) as Partial<Label>;
        const label: Label = {
            id: `label-${nextLabelId++}`,
            name: body.name ?? "",
            dimension: body.dimension ?? "",
            color: body.color ?? "#000000",
        };
        mockLabels = [...mockLabels, label];
        return HttpResponse.json(
            { success: true, message: "Label created", data: label },
            { status: 201 }
        );
    }),

    http.patch("http://localhost:8000/admin/labels/:id", async ({ params, request }) => {
        if (!request.headers.get("Authorization")?.includes(ADMIN_ACCESS_TOKEN)) {
            return new HttpResponse(null, { status: 403 });
        }
        const label = mockLabels.find((candidate) => candidate.id === params.id);
        if (!label) {
            return new HttpResponse(null, { status: 404 });
        }
        const body = (await request.json()) as Partial<Label>;
        Object.assign(label, body);
        return HttpResponse.json({ success: true, message: "Label updated", data: label });
    }),

    http.get("http://localhost:8000/admin/workflow-config", ({ request }) => {
        if (!request.headers.get("Authorization")?.includes(ADMIN_ACCESS_TOKEN)) {
            return new HttpResponse(null, { status: 403 });
        }
        return HttpResponse.json({ success: true, message: "OK", data: workflowConfig });
    }),

    http.patch("http://localhost:8000/admin/workflow-config/:status", async ({ params, request }) => {
        if (!request.headers.get("Authorization")?.includes(ADMIN_ACCESS_TOKEN)) {
            return new HttpResponse(null, { status: 403 });
        }
        const entry = workflowConfig.find((candidate) => candidate.status === params.status);
        if (!entry) {
            return new HttpResponse(null, { status: 404 });
        }
        const body = (await request.json()) as { wip_limit: number | null };
        entry.wip_limit = body.wip_limit;
        return HttpResponse.json({ success: true, message: "Workflow config updated", data: entry });
    }),

    http.get("http://localhost:8000/admin/agent-tokens", ({ request }) => {
        if (!request.headers.get("Authorization")?.includes(ADMIN_ACCESS_TOKEN)) {
            return new HttpResponse(null, { status: 403 });
        }
        return HttpResponse.json({ success: true, message: "OK", data: agentTokens });
    }),

    http.post("http://localhost:8000/admin/agent-tokens", async ({ request }) => {
        if (!request.headers.get("Authorization")?.includes(ADMIN_ACCESS_TOKEN)) {
            return new HttpResponse(null, { status: 403 });
        }
        const body = (await request.json()) as { actor_id: string; scope: string[] };
        const actor = users.find((candidate) => candidate.id === body.actor_id);
        const entry: AgentTokenEntry = {
            id: `token-${nextAgentTokenId++}`,
            actor_id: body.actor_id,
            actor_name: actor?.name ?? "Unknown",
            scope: body.scope,
            active: true,
            created_at: new Date(0).toISOString(),
        };
        agentTokens = [...agentTokens, entry];
        return HttpResponse.json(
            {
                success: true,
                message: "Token created",
                data: { ...entry, token: `raw-secret-${entry.id}` },
            },
            { status: 201 }
        );
    }),

    http.delete("http://localhost:8000/admin/agent-tokens/:id", ({ params, request }) => {
        if (!request.headers.get("Authorization")?.includes(ADMIN_ACCESS_TOKEN)) {
            return new HttpResponse(null, { status: 403 });
        }
        const entry = agentTokens.find((candidate) => candidate.id === params.id);
        if (!entry) {
            return new HttpResponse(null, { status: 404 });
        }
        entry.active = false;
        return HttpResponse.json({ success: true, message: "Token revoked", data: entry });
    }),

    http.get("http://localhost:8000/admin/notification-config", ({ request }) => {
        if (!request.headers.get("Authorization")?.includes(ADMIN_ACCESS_TOKEN)) {
            return new HttpResponse(null, { status: 403 });
        }
        return HttpResponse.json({ success: true, message: "OK", data: notificationConfig });
    }),

    http.patch("http://localhost:8000/admin/notification-config", async ({ request }) => {
        if (!request.headers.get("Authorization")?.includes(ADMIN_ACCESS_TOKEN)) {
            return new HttpResponse(null, { status: 403 });
        }
        const body = (await request.json()) as Partial<NotificationConfig>;
        Object.assign(notificationConfig, body);
        return HttpResponse.json({
            success: true,
            message: "Notification config updated",
            data: notificationConfig,
        });
    }),

    // Accepts the realtime WebSocket connection so tests that render the full app
    // (and therefore trigger `connectRealtime` after login) don't log an "unhandled
    // connection" error. No messages are sent here — `Realtime.spec.tsx` simulates
    // incoming events via its own fake socket, independent of this mock.
    ws.link("ws://localhost:8000/ws").addEventListener("connection", () => {
        /* accept and do nothing */
    }),
];
