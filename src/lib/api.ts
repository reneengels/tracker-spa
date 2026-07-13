import { getAccessToken } from "@/lib/tokenStorage";
import type { TaskStatus } from "@/lib/taskStatus";

const API_BASE_URL: string =
    (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:8000";

export interface LoginRequest {
    username: string;
    password: string;
}

export interface LoginResponse {
    access_token: string;
    refresh_token: string;
    token_type: string;
}

/**
 * Every tracker-api response body is wrapped in this envelope
 * (app/schemas/api/base.py `SuccessResponse`/`ErrorResponse`) — the
 * actual payload lives under `data`, and error messages under `message`.
 */
interface SuccessEnvelope<T> {
    success: boolean;
    message: string;
    data: T;
}

export class ApiError extends Error {
    readonly status: number;

    constructor(message: string, status: number) {
        super(message);
        this.name = "ApiError";
        this.status = status;
    }
}

export async function login(credentials: LoginRequest): Promise<LoginResponse> {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
    });

    if (!response.ok) {
        throw new ApiError("Invalid username or password", response.status);
    }

    const envelope = (await response.json()) as SuccessEnvelope<LoginResponse>;
    return envelope.data;
}

export interface Collaborator {
    id: string;
    name: string;
    type: "human" | "ai_agent";
}

/** Minimal reference to a blocking task — enough to render a chip (key, title, status). */
export interface TaskLite {
    id: string;
    task_key: string;
    title: string;
    status: TaskStatus;
}

export interface Task {
    id: string;
    task_key: string;
    title: string;
    description: string;
    status: TaskStatus;
    priority: "URGENT" | "HIGH" | "NORMAL" | "LOW";
    due_date: string | null;
    estimate_value: number | null;
    estimate_unit: "POINTS" | null;
    type: "FEATURE" | "AJUSTE" | "SUGESTAO" | "REWORK";
    rework_origin_stage: string | null;
    last_return_reason: string | null;
    return_count: number;
    tags: string[] | null;
    demand_source: "PO" | "BOT" | "CANAL" | "AGENTE_PO";
    parent_task_id: string | null;
    version: number;
    created_at: string;
    updated_at: string;
    collaborators: Collaborator[];
    blocked_by: TaskLite[];
}

export interface CreateTaskRequest {
    title: string;
    description: string;
}

export interface TransitionTaskRequest {
    to_status: TaskStatus;
    reason?: string;
}

export interface AddDependencyRequest {
    depends_on_task_id: string;
}

export interface ActorRef {
    id: string;
    name: string;
    type: "human" | "ai_agent";
}

export interface TaskComment {
    id: string;
    body: string;
    author: ActorRef;
    transition_id: string | null;
    created_at: string;
}

export interface StatusTransitionEntry {
    id: string;
    from_status: TaskStatus;
    to_status: TaskStatus;
    reason: string | null;
    actor: ActorRef;
    created_at: string;
}

export interface CodeArtifact {
    id: string;
    kind: "PR" | "BRANCH" | "COMMIT";
    url: string;
    label: string;
    created_by: ActorRef;
    created_at: string;
}

export interface TaskDetail extends Task {
    comments: TaskComment[];
    transitions: StatusTransitionEntry[];
    code_artifacts: CodeArtifact[];
}

export interface UpdateTaskRequest {
    version: number;
    title?: string;
    description?: string;
    priority?: Task["priority"];
    due_date?: string | null;
    estimate_value?: number | null;
    estimate_unit?: Task["estimate_unit"];
    type?: Task["type"];
    tags?: string[] | null;
    demand_source?: Task["demand_source"];
    return_count?: number;
    rework_origin_stage?: string | null;
    last_return_reason?: string | null;
}

export interface NextStatusResponse {
    suggested: TaskStatus | null;
    valid_transitions: TaskStatus[];
}

async function extractErrorMessage(response: Response, fallback: string): Promise<string> {
    try {
        const body = (await response.json()) as { message?: string };
        return body.message ?? fallback;
    } catch {
        return fallback;
    }
}

async function authenticatedFetch(path: string, init: RequestInit = {}): Promise<Response> {
    const accessToken = getAccessToken();
    const headers = new Headers(init.headers);
    headers.set("Content-Type", "application/json");
    if (accessToken) {
        headers.set("Authorization", `Bearer ${accessToken}`);
    }
    return fetch(`${API_BASE_URL}${path}`, { ...init, headers });
}

export async function listTasks(): Promise<Task[]> {
    const response = await authenticatedFetch("/tasks");
    if (!response.ok) {
        throw new ApiError(
            await extractErrorMessage(response, "Não foi possível carregar as tarefas."),
            response.status
        );
    }
    const envelope = (await response.json()) as SuccessEnvelope<Task[]>;
    return envelope.data;
}

export async function createTask(input: CreateTaskRequest): Promise<Task> {
    const response = await authenticatedFetch("/tasks", {
        method: "POST",
        body: JSON.stringify(input),
    });
    if (!response.ok) {
        throw new ApiError(
            await extractErrorMessage(response, "Não foi possível criar a tarefa."),
            response.status
        );
    }
    const envelope = (await response.json()) as SuccessEnvelope<Task>;
    return envelope.data;
}

export async function transitionTask(
    taskId: string,
    input: TransitionTaskRequest
): Promise<Task> {
    const response = await authenticatedFetch(`/tasks/${taskId}/transitions`, {
        method: "POST",
        body: JSON.stringify(input),
    });
    if (!response.ok) {
        throw new ApiError(
            await extractErrorMessage(response, "Não foi possível mover a tarefa."),
            response.status
        );
    }
    const envelope = (await response.json()) as SuccessEnvelope<Task>;
    return envelope.data;
}

export async function joinTask(taskId: string): Promise<Task> {
    const response = await authenticatedFetch(`/tasks/${taskId}/collaborators`, {
        method: "POST",
    });
    if (!response.ok) {
        throw new ApiError(
            await extractErrorMessage(response, "Não foi possível entrar na tarefa."),
            response.status
        );
    }
    const envelope = (await response.json()) as SuccessEnvelope<Task>;
    return envelope.data;
}

export async function leaveTask(taskId: string): Promise<Task> {
    const response = await authenticatedFetch(`/tasks/${taskId}/collaborators`, {
        method: "DELETE",
    });
    if (!response.ok) {
        throw new ApiError(
            await extractErrorMessage(response, "Não foi possível sair da tarefa."),
            response.status
        );
    }
    const envelope = (await response.json()) as SuccessEnvelope<Task>;
    return envelope.data;
}

export async function addDependency(
    taskId: string,
    input: AddDependencyRequest
): Promise<Task> {
    const response = await authenticatedFetch(`/tasks/${taskId}/dependencies`, {
        method: "POST",
        body: JSON.stringify(input),
    });
    if (!response.ok) {
        throw new ApiError(
            await extractErrorMessage(response, "Não foi possível adicionar o bloqueio."),
            response.status
        );
    }
    const envelope = (await response.json()) as SuccessEnvelope<Task>;
    return envelope.data;
}

export async function removeDependency(
    taskId: string,
    dependsOnTaskId: string
): Promise<Task> {
    const response = await authenticatedFetch(
        `/tasks/${taskId}/dependencies/${dependsOnTaskId}`,
        { method: "DELETE" }
    );
    if (!response.ok) {
        throw new ApiError(
            await extractErrorMessage(response, "Não foi possível remover o bloqueio."),
            response.status
        );
    }
    const envelope = (await response.json()) as SuccessEnvelope<Task>;
    return envelope.data;
}

export async function getTask(taskId: string): Promise<TaskDetail> {
    const response = await authenticatedFetch(`/tasks/${taskId}`);
    if (!response.ok) {
        throw new ApiError(
            await extractErrorMessage(response, "Não foi possível carregar a tarefa."),
            response.status
        );
    }
    const envelope = (await response.json()) as SuccessEnvelope<TaskDetail>;
    return envelope.data;
}

export async function updateTask(taskId: string, input: UpdateTaskRequest): Promise<Task> {
    const response = await authenticatedFetch(`/tasks/${taskId}`, {
        method: "PATCH",
        body: JSON.stringify(input),
    });
    if (!response.ok) {
        throw new ApiError(
            await extractErrorMessage(response, "Não foi possível salvar as alterações."),
            response.status
        );
    }
    const envelope = (await response.json()) as SuccessEnvelope<Task>;
    return envelope.data;
}

export async function getNextStatus(taskId: string): Promise<NextStatusResponse> {
    const response = await authenticatedFetch(`/tasks/${taskId}/next-status`);
    if (!response.ok) {
        throw new ApiError(
            await extractErrorMessage(response, "Não foi possível calcular o próximo status."),
            response.status
        );
    }
    const envelope = (await response.json()) as SuccessEnvelope<NextStatusResponse>;
    return envelope.data;
}

export async function addComment(taskId: string, body: string): Promise<TaskComment> {
    const response = await authenticatedFetch(`/tasks/${taskId}/comments`, {
        method: "POST",
        body: JSON.stringify({ body }),
    });
    if (!response.ok) {
        throw new ApiError(
            await extractErrorMessage(response, "Não foi possível adicionar o comentário."),
            response.status
        );
    }
    const envelope = (await response.json()) as SuccessEnvelope<TaskComment>;
    return envelope.data;
}
