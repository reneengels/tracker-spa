import { getAccessToken } from "@/lib/tokenStorage";
import type { TaskStatus } from "@/lib/taskStatus";
import type { SessionRole } from "@/lib/jwt";

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

export interface Label {
    id: string;
    name: string;
    dimension: string;
    color: string;
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
    labels: Label[];
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

export interface TaskSearchParams {
    collaboratorIds?: string[];
    priorities?: Task["priority"][];
    type?: Task["type"];
    labelIds?: string[];
    projectEpicoLabelId?: string;
    tags?: string[];
    q?: string;
    cursor?: string;
    limit?: number;
    /** Server-side role-based relevance filter (ticket 11) — status compatible with the
     * caller's role AND (collaborator OR unassigned). Omitted entirely when falsy. */
    myQueue?: boolean;
}

export interface TaskSearchResult {
    tasks: Task[];
    next_cursor: string | null;
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

function buildSearchQuery(params: TaskSearchParams): string {
    const query = new URLSearchParams();
    for (const id of params.collaboratorIds ?? []) query.append("collaborator_id", id);
    for (const priority of params.priorities ?? []) query.append("priority", priority);
    if (params.type) query.set("type", params.type);
    for (const id of params.labelIds ?? []) query.append("label_id", id);
    if (params.projectEpicoLabelId) query.set("project_epico_label_id", params.projectEpicoLabelId);
    for (const tag of params.tags ?? []) query.append("tags", tag);
    if (params.q) query.set("q", params.q);
    if (params.cursor) query.set("cursor", params.cursor);
    if (params.myQueue) query.set("my_queue", "true");
    query.set("limit", String(params.limit ?? 30));
    return query.toString();
}

export async function searchTasks(params: TaskSearchParams): Promise<TaskSearchResult> {
    const response = await authenticatedFetch(`/tasks/search?${buildSearchQuery(params)}`);
    if (!response.ok) {
        throw new ApiError(
            await extractErrorMessage(response, "Não foi possível buscar as tarefas."),
            response.status
        );
    }
    const envelope = (await response.json()) as SuccessEnvelope<TaskSearchResult>;
    return envelope.data;
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

// ---------------------------------------------------------------------------
// Admin (ticket 12) — users/roles, labels, WIP limits, agent tokens. All
// `/admin/*` endpoints require the Admin role server-side; `GET /labels` is
// the one read that's open to any authenticated user (reused by list-view
// filters).

export interface AdminUser {
    id: string;
    name: string;
    email: string | null;
    type: "human" | "ai_agent";
    role: SessionRole;
    active: boolean;
}

export interface CreateUserRequest {
    name: string;
    type: "human" | "ai_agent";
    role: SessionRole;
    email?: string;
    /** Required when `type` is "human"; omitted for "ai_agent". */
    password?: string;
}

export interface UpdateUserRequest {
    name?: string;
    role?: SessionRole;
    active?: boolean;
}

export async function listUsers(): Promise<AdminUser[]> {
    const response = await authenticatedFetch("/admin/users");
    if (!response.ok) {
        throw new ApiError(
            await extractErrorMessage(response, "Não foi possível carregar os usuários."),
            response.status
        );
    }
    const envelope = (await response.json()) as SuccessEnvelope<AdminUser[]>;
    return envelope.data;
}

export async function createUser(input: CreateUserRequest): Promise<AdminUser> {
    const response = await authenticatedFetch("/admin/users", {
        method: "POST",
        body: JSON.stringify(input),
    });
    if (!response.ok) {
        throw new ApiError(
            await extractErrorMessage(response, "Não foi possível criar o usuário."),
            response.status
        );
    }
    const envelope = (await response.json()) as SuccessEnvelope<AdminUser>;
    return envelope.data;
}

export async function updateUser(id: string, input: UpdateUserRequest): Promise<AdminUser> {
    const response = await authenticatedFetch(`/admin/users/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
    });
    if (!response.ok) {
        throw new ApiError(
            await extractErrorMessage(response, "Não foi possível salvar o usuário."),
            response.status
        );
    }
    const envelope = (await response.json()) as SuccessEnvelope<AdminUser>;
    return envelope.data;
}

export interface CreateLabelRequest {
    name: string;
    dimension: string;
    color: string;
}

export type UpdateLabelRequest = Partial<CreateLabelRequest>;

export async function listLabels(): Promise<Label[]> {
    const response = await authenticatedFetch("/labels");
    if (!response.ok) {
        throw new ApiError(
            await extractErrorMessage(response, "Não foi possível carregar as labels."),
            response.status
        );
    }
    const envelope = (await response.json()) as SuccessEnvelope<Label[]>;
    return envelope.data;
}

export async function createLabel(input: CreateLabelRequest): Promise<Label> {
    const response = await authenticatedFetch("/admin/labels", {
        method: "POST",
        body: JSON.stringify(input),
    });
    if (!response.ok) {
        throw new ApiError(
            await extractErrorMessage(response, "Não foi possível criar a label."),
            response.status
        );
    }
    const envelope = (await response.json()) as SuccessEnvelope<Label>;
    return envelope.data;
}

export async function updateLabel(id: string, input: UpdateLabelRequest): Promise<Label> {
    const response = await authenticatedFetch(`/admin/labels/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
    });
    if (!response.ok) {
        throw new ApiError(
            await extractErrorMessage(response, "Não foi possível salvar a label."),
            response.status
        );
    }
    const envelope = (await response.json()) as SuccessEnvelope<Label>;
    return envelope.data;
}

export interface WorkflowConfigEntry {
    status: TaskStatus;
    wip_limit: number | null;
}

export async function listWorkflowConfig(): Promise<WorkflowConfigEntry[]> {
    const response = await authenticatedFetch("/admin/workflow-config");
    if (!response.ok) {
        throw new ApiError(
            await extractErrorMessage(response, "Não foi possível carregar os limites de WIP."),
            response.status
        );
    }
    const envelope = (await response.json()) as SuccessEnvelope<WorkflowConfigEntry[]>;
    return envelope.data;
}

export async function updateWorkflowConfig(
    status: TaskStatus,
    wipLimit: number | null
): Promise<WorkflowConfigEntry> {
    const response = await authenticatedFetch(`/admin/workflow-config/${status}`, {
        method: "PATCH",
        body: JSON.stringify({ wip_limit: wipLimit }),
    });
    if (!response.ok) {
        throw new ApiError(
            await extractErrorMessage(response, "Não foi possível salvar o limite de WIP."),
            response.status
        );
    }
    const envelope = (await response.json()) as SuccessEnvelope<WorkflowConfigEntry>;
    return envelope.data;
}

export interface AgentTokenEntry {
    id: string;
    actor_id: string;
    actor_name: string;
    scope: string[];
    active: boolean;
    created_at: string;
}

export interface CreateAgentTokenRequest {
    actor_id: string;
    scope: string[];
}

export interface CreateAgentTokenResponse extends AgentTokenEntry {
    /** The raw opaque token — shown ONLY in this response, never retrievable again. */
    token: string;
}

export async function listAgentTokens(): Promise<AgentTokenEntry[]> {
    const response = await authenticatedFetch("/admin/agent-tokens");
    if (!response.ok) {
        throw new ApiError(
            await extractErrorMessage(response, "Não foi possível carregar os tokens de agente."),
            response.status
        );
    }
    const envelope = (await response.json()) as SuccessEnvelope<AgentTokenEntry[]>;
    return envelope.data;
}

export async function createAgentToken(
    input: CreateAgentTokenRequest
): Promise<CreateAgentTokenResponse> {
    const response = await authenticatedFetch("/admin/agent-tokens", {
        method: "POST",
        body: JSON.stringify(input),
    });
    if (!response.ok) {
        throw new ApiError(
            await extractErrorMessage(response, "Não foi possível criar o token."),
            response.status
        );
    }
    const envelope = (await response.json()) as SuccessEnvelope<CreateAgentTokenResponse>;
    return envelope.data;
}

export async function revokeAgentToken(id: string): Promise<void> {
    const response = await authenticatedFetch(`/admin/agent-tokens/${id}`, {
        method: "DELETE",
    });
    if (!response.ok) {
        throw new ApiError(
            await extractErrorMessage(response, "Não foi possível revogar o token."),
            response.status
        );
    }
}

export interface NotificationConfig {
    webhook_url: string | null;
    webhook_enabled: boolean;
    queue_low_threshold: number | null;
    network_egress_enabled: boolean;
}

export async function getNotificationConfig(): Promise<NotificationConfig> {
    const response = await authenticatedFetch("/admin/notification-config");
    if (!response.ok) {
        throw new ApiError(
            await extractErrorMessage(response, "Não foi possível carregar a configuração de notificações."),
            response.status
        );
    }
    const envelope = (await response.json()) as SuccessEnvelope<NotificationConfig>;
    return envelope.data;
}

export async function updateNotificationConfig(
    partial: Partial<NotificationConfig>
): Promise<NotificationConfig> {
    const response = await authenticatedFetch("/admin/notification-config", {
        method: "PATCH",
        body: JSON.stringify(partial),
    });
    if (!response.ok) {
        throw new ApiError(
            await extractErrorMessage(response, "Não foi possível salvar a configuração de notificações."),
            response.status
        );
    }
    const envelope = (await response.json()) as SuccessEnvelope<NotificationConfig>;
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
