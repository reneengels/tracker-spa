import { http, HttpResponse } from "msw";
import type { Task } from "@/lib/api";

const VALID_ACCESS_TOKEN =
    "eyJhbGciOiAiSFMyNTYiLCAidHlwIjogIkpXVCJ9." +
    "eyJzdWIiOiAicG8tdXNlciIsICJyb2xlIjogIlBPIn0." +
    "test-signature";

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
];
