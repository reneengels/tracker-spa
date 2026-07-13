import { http, HttpResponse } from "msw";
import type { StatusTransitionEntry, Task, TaskComment, TaskDetail } from "@/lib/api";
import type { TaskStatus } from "@/lib/taskStatus";

export const VALID_ACCESS_TOKEN =
    "eyJhbGciOiAiSFMyNTYiLCAidHlwIjogIkpXVCJ9." +
    "eyJzdWIiOiAicG8tdXNlciIsICJyb2xlIjogIlBPIn0." +
    "test-signature";

/** The actor id encoded in `VALID_ACCESS_TOKEN`'s `sub` claim — join/leave mocks act as this user. */
export const MOCK_CURRENT_ACTOR = { id: "po-user", name: "PO User", type: "human" as const };

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
    };
}

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
        return HttpResponse.json({ success: true, message: "Comment added", data: toDetail(task) });
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
];
