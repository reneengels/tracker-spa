import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, useParams } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
    ApiError,
    addComment,
    addDependency,
    getNextStatus,
    getTask,
    joinTask,
    leaveTask,
    listTasks,
    removeDependency,
    transitionTask,
    updateTask,
    type Task,
    type TaskDetail as TaskDetailData,
    type UpdateTaskRequest,
} from "@/lib/api";
import { BOARD_COLUMNS, statusLabel, type TaskStatus } from "@/lib/taskStatus";
import { Button } from "@/components/ui/button.tsx";
import { CollaboratorAvatars } from "@/components/CollaboratorAvatars";
import { useAuth } from "@/lib/auth";

const TASKS_QUERY_KEY = ["tasks"] as const;
const taskQueryKey = (taskId: string) => ["task", taskId] as const;
const nextStatusQueryKey = (taskId: string) => ["task", taskId, "next-status"] as const;

interface EditableForm {
    title: string;
    description: string;
    priority: Task["priority"];
    due_date: string;
    estimate_value: string;
    estimate_unit: Task["estimate_unit"];
    type: Task["type"];
    tags: string;
    demand_source: Task["demand_source"];
    return_count: string;
    rework_origin_stage: string;
    last_return_reason: string;
}

function toEditableForm(task: TaskDetailData): EditableForm {
    return {
        title: task.title,
        description: task.description,
        priority: task.priority,
        due_date: task.due_date ?? "",
        estimate_value: task.estimate_value === null ? "" : String(task.estimate_value),
        estimate_unit: task.estimate_unit,
        type: task.type,
        tags: (task.tags ?? []).join(", "),
        demand_source: task.demand_source,
        return_count: String(task.return_count),
        rework_origin_stage: task.rework_origin_stage ?? "",
        last_return_reason: task.last_return_reason ?? "",
    };
}

function toUpdateRequest(form: EditableForm, version: number): UpdateTaskRequest {
    const tags = form.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);
    return {
        version,
        title: form.title,
        description: form.description,
        priority: form.priority,
        due_date: form.due_date || null,
        estimate_value: form.estimate_value === "" ? null : Number(form.estimate_value),
        estimate_unit: form.estimate_unit,
        type: form.type,
        tags: tags.length > 0 ? tags : null,
        demand_source: form.demand_source,
        return_count: Number(form.return_count),
        rework_origin_stage: form.rework_origin_stage === "" ? null : form.rework_origin_stage,
        last_return_reason: form.last_return_reason === "" ? null : form.last_return_reason,
    };
}

function TaskFieldsForm({ task }: { task: TaskDetailData }) {
    const queryClient = useQueryClient();
    const [form, setForm] = useState<EditableForm | null>(null);

    useEffect(() => {
        if (form === null) {
            setForm(toEditableForm(task));
        }
    }, [task, form]);

    const mutation = useMutation({
        mutationFn: () => updateTask(task.id, toUpdateRequest(form as EditableForm, task.version)),
        onSuccess: () => {
            toast.success("Alterações salvas.");
        },
        onError: (error) => {
            toast.error(
                error instanceof ApiError ? error.message : "Não foi possível salvar as alterações."
            );
        },
        onSettled: () => {
            setForm(null);
            void queryClient.invalidateQueries({ queryKey: taskQueryKey(task.id) });
            void queryClient.invalidateQueries({ queryKey: TASKS_QUERY_KEY });
        },
    });

    if (form === null) {
        return null;
    }

    const handleSubmit = (event: FormEvent) => {
        event.preventDefault();
        mutation.mutate();
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-3 bg-white rounded-lg border border-slate-200 p-4">
            <div className="space-y-1">
                <label htmlFor="field-title" className="text-sm font-medium text-slate-700">
                    Título
                </label>
                <input
                    id="field-title"
                    value={form.title}
                    onChange={(event) => setForm({ ...form, title: event.target.value })}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
            </div>

            <div className="space-y-1">
                <label htmlFor="field-description" className="text-sm font-medium text-slate-700">
                    Descrição
                </label>
                <textarea
                    id="field-description"
                    value={form.description}
                    onChange={(event) => setForm({ ...form, description: event.target.value })}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    rows={3}
                />
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                    <label htmlFor="field-priority" className="text-sm font-medium text-slate-700">
                        Prioridade
                    </label>
                    <select
                        id="field-priority"
                        value={form.priority}
                        onChange={(event) =>
                            setForm({ ...form, priority: event.target.value as Task["priority"] })
                        }
                        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    >
                        <option value="LOW">Low</option>
                        <option value="NORMAL">Normal</option>
                        <option value="HIGH">High</option>
                        <option value="URGENT">Urgent</option>
                    </select>
                </div>

                <div className="space-y-1">
                    <label htmlFor="field-type" className="text-sm font-medium text-slate-700">
                        Tipo
                    </label>
                    <select
                        id="field-type"
                        value={form.type}
                        onChange={(event) => setForm({ ...form, type: event.target.value as Task["type"] })}
                        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    >
                        <option value="FEATURE">Feature</option>
                        <option value="AJUSTE">Ajuste</option>
                        <option value="SUGESTAO">Sugestão</option>
                        <option value="REWORK">Rework</option>
                    </select>
                </div>

                <div className="space-y-1">
                    <label htmlFor="field-due-date" className="text-sm font-medium text-slate-700">
                        Prazo
                    </label>
                    <input
                        id="field-due-date"
                        type="date"
                        value={form.due_date}
                        onChange={(event) => setForm({ ...form, due_date: event.target.value })}
                        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    />
                </div>

                <div className="space-y-1">
                    <label htmlFor="field-demand-source" className="text-sm font-medium text-slate-700">
                        Origem da demanda
                    </label>
                    <select
                        id="field-demand-source"
                        value={form.demand_source}
                        onChange={(event) =>
                            setForm({ ...form, demand_source: event.target.value as Task["demand_source"] })
                        }
                        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    >
                        <option value="PO">PO</option>
                        <option value="BOT">Bot</option>
                        <option value="CANAL">Canal</option>
                        <option value="AGENTE_PO">Agente PO</option>
                    </select>
                </div>

                <div className="space-y-1">
                    <label htmlFor="field-estimate-value" className="text-sm font-medium text-slate-700">
                        Estimativa
                    </label>
                    <input
                        id="field-estimate-value"
                        type="number"
                        value={form.estimate_value}
                        onChange={(event) => setForm({ ...form, estimate_value: event.target.value })}
                        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    />
                </div>

                <div className="space-y-1">
                    <label htmlFor="field-estimate-unit" className="text-sm font-medium text-slate-700">
                        Unidade da estimativa
                    </label>
                    <select
                        id="field-estimate-unit"
                        value={form.estimate_unit ?? ""}
                        onChange={(event) =>
                            setForm({
                                ...form,
                                estimate_unit: (event.target.value || null) as Task["estimate_unit"],
                            })
                        }
                        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    >
                        <option value="">—</option>
                        <option value="POINTS">Points</option>
                    </select>
                </div>

                <div className="space-y-1">
                    <label htmlFor="field-return-count" className="text-sm font-medium text-slate-700">
                        Nº de retornos
                    </label>
                    <input
                        id="field-return-count"
                        type="number"
                        min={0}
                        value={form.return_count}
                        onChange={(event) => setForm({ ...form, return_count: event.target.value })}
                        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    />
                </div>

                <div className="space-y-1">
                    <label htmlFor="field-rework-origin" className="text-sm font-medium text-slate-700">
                        Etapa de origem (rework)
                    </label>
                    <select
                        id="field-rework-origin"
                        value={form.rework_origin_stage}
                        onChange={(event) => setForm({ ...form, rework_origin_stage: event.target.value })}
                        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    >
                        <option value="">—</option>
                        <option value="REVIEW_HUMANO">Review Humano</option>
                        <option value="QA">QA</option>
                    </select>
                </div>
            </div>

            <div className="space-y-1">
                <label htmlFor="field-tags" className="text-sm font-medium text-slate-700">
                    Labels/tags (separadas por vírgula)
                </label>
                <input
                    id="field-tags"
                    value={form.tags}
                    onChange={(event) => setForm({ ...form, tags: event.target.value })}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
            </div>

            <div className="space-y-1">
                <label htmlFor="field-last-return-reason" className="text-sm font-medium text-slate-700">
                    Motivo do último retorno
                </label>
                <textarea
                    id="field-last-return-reason"
                    value={form.last_return_reason}
                    onChange={(event) => setForm({ ...form, last_return_reason: event.target.value })}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    rows={2}
                />
            </div>

            <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
        </form>
    );
}

function StatusChanger({ task }: { task: TaskDetailData }) {
    const queryClient = useQueryClient();
    const [selectedStatus, setSelectedStatus] = useState<TaskStatus>(task.status);
    const [reason, setReason] = useState("");

    useEffect(() => {
        setSelectedStatus(task.status);
    }, [task.status]);

    const { data: nextStatus } = useQuery({
        queryKey: nextStatusQueryKey(task.id),
        queryFn: () => getNextStatus(task.id),
    });

    const invalidateAfterTransition = () => {
        void queryClient.invalidateQueries({ queryKey: taskQueryKey(task.id) });
        void queryClient.invalidateQueries({ queryKey: nextStatusQueryKey(task.id) });
        void queryClient.invalidateQueries({ queryKey: TASKS_QUERY_KEY });
    };

    const transitionMutation = useMutation({
        mutationFn: (input: { to_status: TaskStatus; reason?: string }) =>
            transitionTask(task.id, input),
        onSuccess: () => {
            setReason("");
        },
        onError: (error) => {
            toast.error(
                error instanceof ApiError ? error.message : "Não foi possível mover a tarefa."
            );
        },
        onSettled: invalidateAfterTransition,
    });

    const handleSubmit = (event: FormEvent) => {
        event.preventDefault();
        transitionMutation.mutate({ to_status: selectedStatus, reason: reason || undefined });
    };

    return (
        <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-3">
            <h2 className="text-sm font-semibold text-slate-600">Status</h2>
            <p className="text-sm text-slate-800">Atual: {statusLabel(task.status)}</p>

            {nextStatus?.suggested && (
                <Button
                    type="button"
                    variant="secondary"
                    disabled={transitionMutation.isPending}
                    onClick={() =>
                        transitionMutation.mutate({ to_status: nextStatus.suggested as TaskStatus })
                    }
                >
                    Avançar para {statusLabel(nextStatus.suggested)}
                </Button>
            )}

            <form onSubmit={handleSubmit} className="space-y-2">
                <div className="space-y-1">
                    <label htmlFor="status-select" className="text-sm font-medium text-slate-700">
                        Mover para
                    </label>
                    <select
                        id="status-select"
                        value={selectedStatus}
                        onChange={(event) => setSelectedStatus(event.target.value as TaskStatus)}
                        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    >
                        {BOARD_COLUMNS.map((column) => (
                            <option key={column.status} value={column.status}>
                                {column.label}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="space-y-1">
                    <label htmlFor="status-reason" className="text-sm font-medium text-slate-700">
                        Comentário (opcional)
                    </label>
                    <input
                        id="status-reason"
                        value={reason}
                        onChange={(event) => setReason(event.target.value)}
                        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    />
                </div>
                <Button type="submit" disabled={transitionMutation.isPending}>
                    Mudar status
                </Button>
            </form>
        </div>
    );
}

function CollaboratorsPanel({ task }: { task: TaskDetailData }) {
    const { session } = useAuth();
    const queryClient = useQueryClient();
    const currentActorId = session?.actorId ?? null;
    const isCollaborator = currentActorId
        ? task.collaborators.some((collaborator) => collaborator.id === currentActorId)
        : false;

    const mutation = useMutation({
        mutationFn: () => (isCollaborator ? leaveTask(task.id) : joinTask(task.id)),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: taskQueryKey(task.id) });
            void queryClient.invalidateQueries({ queryKey: TASKS_QUERY_KEY });
        },
        onError: (error) => {
            toast.error(
                error instanceof ApiError ? error.message : "Não foi possível atualizar os colaboradores."
            );
        },
    });

    return (
        <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-2">
            <h2 className="text-sm font-semibold text-slate-600">Colaboradores</h2>
            <CollaboratorAvatars collaborators={task.collaborators} />
            <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={mutation.isPending}
                onClick={() => mutation.mutate()}
            >
                {isCollaborator ? "Sair" : "Pegar esta tarefa"}
            </Button>
        </div>
    );
}

function BlockedByPanel({ task }: { task: TaskDetailData }) {
    const queryClient = useQueryClient();
    const [query, setQuery] = useState("");

    const { data: allTasks = [] } = useQuery({
        queryKey: TASKS_QUERY_KEY,
        queryFn: listTasks,
    });

    const invalidate = () => {
        void queryClient.invalidateQueries({ queryKey: taskQueryKey(task.id) });
    };

    const addMutation = useMutation({
        mutationFn: (blockerId: string) => addDependency(task.id, { depends_on_task_id: blockerId }),
        onSuccess: () => {
            setQuery("");
            invalidate();
        },
        onError: (error) => {
            toast.error(
                error instanceof ApiError ? error.message : "Não foi possível adicionar o bloqueio."
            );
        },
    });

    const removeMutation = useMutation({
        mutationFn: (blockerId: string) => removeDependency(task.id, blockerId),
        onSuccess: invalidate,
        onError: (error) => {
            toast.error(
                error instanceof ApiError ? error.message : "Não foi possível remover o bloqueio."
            );
        },
    });

    const normalizedQuery = query.trim().toLowerCase();
    const matches =
        normalizedQuery.length === 0
            ? []
            : allTasks.filter(
                  (candidate) =>
                      candidate.id !== task.id &&
                      !task.blocked_by.some((blocker) => blocker.id === candidate.id) &&
                      (candidate.task_key.toLowerCase().includes(normalizedQuery) ||
                          candidate.title.toLowerCase().includes(normalizedQuery))
              );

    return (
        <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-3">
            <h2 className="text-sm font-semibold text-slate-600">Bloqueada por</h2>

            <div className="flex flex-wrap gap-2">
                {task.blocked_by.map((blocker) => (
                    <span
                        key={blocker.id}
                        className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-xs text-amber-800"
                    >
                        <Link to={`/tasks/${blocker.id}`} className="hover:underline">
                            {blocker.task_key} · {blocker.title} ({statusLabel(blocker.status)})
                        </Link>
                        <button
                            type="button"
                            aria-label={`Remover bloqueio ${blocker.task_key}`}
                            onClick={() => removeMutation.mutate(blocker.id)}
                            className="text-amber-700 hover:text-amber-900"
                        >
                            ×
                        </button>
                    </span>
                ))}
            </div>

            <div className="space-y-1">
                <label htmlFor="blocker-search" className="text-sm font-medium text-slate-700">
                    Adicionar tarefa bloqueadora
                </label>
                <input
                    id="blocker-search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Buscar por chave ou título..."
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
                {matches.length > 0 && (
                    <ul className="rounded-md border border-slate-200 divide-y divide-slate-100">
                        {matches.map((match) => (
                            <li key={match.id}>
                                <button
                                    type="button"
                                    onClick={() => addMutation.mutate(match.id)}
                                    className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50"
                                >
                                    {match.task_key} · {match.title}
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}

function CommentsAndHistoryPanel({ task }: { task: TaskDetailData }) {
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState<"comments" | "history">("comments");
    const [commentBody, setCommentBody] = useState("");

    const commentMutation = useMutation({
        mutationFn: () => addComment(task.id, commentBody),
        onSuccess: () => {
            setCommentBody("");
            void queryClient.invalidateQueries({ queryKey: taskQueryKey(task.id) });
        },
        onError: (error) => {
            toast.error(
                error instanceof ApiError ? error.message : "Não foi possível adicionar o comentário."
            );
        },
    });

    const handleSubmit = (event: FormEvent) => {
        event.preventDefault();
        if (commentBody.trim().length === 0) {
            return;
        }
        commentMutation.mutate();
    };

    return (
        <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-3">
            <div role="tablist" className="flex gap-2 border-b border-slate-200 pb-2">
                <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === "comments"}
                    onClick={() => setActiveTab("comments")}
                    className={`text-sm font-medium px-2 py-1 rounded-md ${
                        activeTab === "comments" ? "bg-slate-100 text-slate-900" : "text-slate-500"
                    }`}
                >
                    Comentários
                </button>
                <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === "history"}
                    onClick={() => setActiveTab("history")}
                    className={`text-sm font-medium px-2 py-1 rounded-md ${
                        activeTab === "history" ? "bg-slate-100 text-slate-900" : "text-slate-500"
                    }`}
                >
                    Histórico
                </button>
            </div>

            {activeTab === "comments" && (
                <div className="space-y-3">
                    <ul className="space-y-2">
                        {task.comments.map((comment) => (
                            <li key={comment.id} className="text-sm border-b border-slate-100 pb-2">
                                <p className="text-slate-800">{comment.body}</p>
                                <p className="text-xs text-slate-400">
                                    {comment.author.name} · {new Date(comment.created_at).toLocaleString()}
                                </p>
                            </li>
                        ))}
                    </ul>
                    <form onSubmit={handleSubmit} className="space-y-2">
                        <textarea
                            value={commentBody}
                            onChange={(event) => setCommentBody(event.target.value)}
                            placeholder="Escreva um comentário..."
                            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                            rows={2}
                        />
                        <Button type="submit" size="sm" disabled={commentMutation.isPending}>
                            Comentar
                        </Button>
                    </form>
                </div>
            )}

            {activeTab === "history" && (
                <ul className="space-y-2">
                    {task.transitions.map((transition) => (
                        <li key={transition.id} className="text-sm border-b border-slate-100 pb-2">
                            <p className="text-slate-800">
                                {statusLabel(transition.from_status)} → {statusLabel(transition.to_status)}
                            </p>
                            <p className="text-xs text-slate-400">
                                {transition.actor.name} · {new Date(transition.created_at).toLocaleString()}
                            </p>
                            {transition.reason && (
                                <p className="text-xs text-slate-500 italic">{transition.reason}</p>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

function CodeArtifactsPanel({ task }: { task: TaskDetailData }) {
    return (
        <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-2">
            <h2 className="text-sm font-semibold text-slate-600">Artefatos de código</h2>
            {task.code_artifacts.length === 0 ? (
                <p className="text-sm text-slate-400">Nenhum artefato de código ainda.</p>
            ) : (
                <ul className="space-y-1">
                    {task.code_artifacts.map((artifact) => (
                        <li key={artifact.id} className="text-sm">
                            <a
                                href={artifact.url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-sky-600 hover:underline"
                            >
                                [{artifact.kind}] {artifact.label}
                            </a>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

export default function TaskDetail() {
    const { taskId } = useParams<{ taskId: string }>();

    const { data: task, isLoading } = useQuery({
        queryKey: taskQueryKey(taskId as string),
        queryFn: () => getTask(taskId as string),
        enabled: Boolean(taskId),
    });

    if (!taskId) {
        return <p className="p-6 text-sm text-slate-500">Tarefa não encontrada.</p>;
    }

    if (isLoading || !task) {
        return <p className="p-6 text-sm text-slate-500">Carregando...</p>;
    }

    return (
        <div className="min-h-screen p-6 bg-slate-50 space-y-4">
            <div>
                <Link to="/board" className="text-sm text-sky-600 hover:underline">
                    ← Voltar ao Board
                </Link>
                <h1 className="text-xl font-bold text-slate-800 mt-1">
                    {task.task_key} · {task.title}
                </h1>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="space-y-4">
                    <TaskFieldsForm task={task} />
                    <BlockedByPanel task={task} />
                </div>
                <div className="space-y-4">
                    <StatusChanger task={task} />
                    <CollaboratorsPanel task={task} />
                    <CommentsAndHistoryPanel task={task} />
                    <CodeArtifactsPanel task={task} />
                </div>
            </div>
        </div>
    );
}
