import { http, HttpResponse } from "msw";
import type { Task } from "@/lib/api";

export const VALID_ACCESS_TOKEN =
    "eyJhbGciOiAiSFMyNTYiLCAidHlwIjogIkpXVCJ9." +
    "eyJzdWIiOiAicG8tdXNlciIsICJyb2xlIjogIlBPIn0." +
    "test-signature";

/** The actor id encoded in `VALID_ACCESS_TOKEN`'s `sub` claim — join/leave mocks act as this user. */
export const MOCK_CURRENT_ACTOR = { id: "po-user", name: "PO User", type: "human" as const };

let tasks: Task[] = [];
let nextSequence = 1;

/** Resets the in-memory mock task store; call between tests to avoid leakage. */
export function resetTasks(seed: Task[] = []): void {
    tasks = seed.map((task) => ({ ...task }));
    nextSequence = tasks.length + 1;
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

    http.post("http://localhost:8000/tasks", async ({ request }) => {
        const body = (await request.json()) as { title: string; description: string };
        const task = makeTask({ title: body.title, description: body.description });
        tasks.push(task);
        return HttpResponse.json(
            { success: true, message: "Task created", data: task },
            { status: 201 }
        );
    }),

    http.post("http://localhost:8000/tasks/:id/transitions", async ({ params, request }) => {
        const body = (await request.json()) as { to_status: Task["status"]; reason?: string };
        const task = tasks.find((candidate) => candidate.id === params.id);
        if (!task) {
            return new HttpResponse(null, { status: 404 });
        }
        task.status = body.to_status;
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
