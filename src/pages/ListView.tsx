import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import { useMutation, useQuery, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
    ApiError,
    getNextStatus,
    searchTasks,
    transitionTask,
    type Label,
    type Task,
} from "@/lib/api";
import { BOARD_COLUMNS, statusLabel, type TaskStatus } from "@/lib/taskStatus";
import { CollaboratorAvatars } from "@/components/CollaboratorAvatars";
import { BlockedByBadge } from "@/components/BlockedByBadge";

/** Matches TanStack Query's default prefix matching for invalidateQueries — any
 * ListView instance, regardless of its specific filter selection, refetches. */
const SEARCH_QUERY_PREFIX = ["tasks", "search"] as const;

const PRIORITIES: Task["priority"][] = ["URGENT", "HIGH", "NORMAL", "LOW"];
const TYPES: Task["type"][] = ["FEATURE", "AJUSTE", "SUGESTAO", "REWORK"];
const PRIORITY_ORDER: Record<Task["priority"], number> = {
    URGENT: 0,
    HIGH: 1,
    NORMAL: 2,
    LOW: 3,
};
const UNASSIGNED = "unassigned";
const PAGE_SIZE = 20;

interface Filters {
    collaboratorIds: string[];
    priorities: Task["priority"][];
    type: Task["type"] | "";
    labelIds: string[];
    projectEpicoLabelId: string;
    tags: string[];
    q: string;
}

const EMPTY_FILTERS: Filters = {
    collaboratorIds: [],
    priorities: [],
    type: "",
    labelIds: [],
    projectEpicoLabelId: "",
    tags: [],
    q: "",
};

function toggle<T>(list: T[], value: T): T[] {
    return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

/** Distinct labels/collaborators/tags seen across loaded tasks — the only source of filter
 * options available in this ticket (no dedicated /labels listing endpoint yet, that's ticket 12). */
function distinctFacets(tasks: Task[]) {
    const labels = new Map<string, Label>();
    const collaborators = new Map<string, Task["collaborators"][number]>();
    const tags = new Set<string>();
    for (const task of tasks) {
        for (const label of task.labels) labels.set(label.id, label);
        for (const collaborator of task.collaborators) collaborators.set(collaborator.id, collaborator);
        for (const tag of task.tags ?? []) tags.add(tag);
    }
    return {
        labels: [...labels.values()],
        collaborators: [...collaborators.values()],
        tags: [...tags],
    };
}

/**
 * Compact per-row status control — same status-selector + suggested-next-shortcut
 * mechanism as the Task Detail page's StatusChanger, without opening the Detail.
 *
 * The "next status" suggestion is fetched lazily (only once this row's control has
 * been focused), not eagerly for every visible row — a page can show 20+ rows, and
 * firing a `GET /tasks/{id}/next-status` per row on render doesn't scale (it's also
 * what caused a real slowdown/timeout under test load before this was made lazy).
 */
function InlineStatusChanger({ task }: { task: Task }) {
    const queryClient = useQueryClient();
    const [selectedStatus, setSelectedStatus] = useState<TaskStatus>(task.status);
    const [interacted, setInteracted] = useState(false);

    useEffect(() => {
        setSelectedStatus(task.status);
    }, [task.status]);

    const { data: nextStatus } = useQuery({
        queryKey: ["task", task.id, "next-status"],
        queryFn: () => getNextStatus(task.id),
        enabled: interacted,
    });

    const invalidate = () => {
        void queryClient.invalidateQueries({ queryKey: SEARCH_QUERY_PREFIX });
    };

    const transitionMutation = useMutation({
        mutationFn: (to_status: TaskStatus) => transitionTask(task.id, { to_status }),
        onError: (error) => {
            toast.error(
                error instanceof ApiError ? error.message : "Não foi possível mover a tarefa."
            );
        },
        onSettled: invalidate,
    });

    return (
        <div className="flex items-center gap-1">
            <select
                aria-label={`Mover ${task.task_key}`}
                value={selectedStatus}
                onFocus={() => setInteracted(true)}
                onChange={(event) => {
                    const to_status = event.target.value as TaskStatus;
                    setSelectedStatus(to_status);
                    transitionMutation.mutate(to_status);
                }}
                disabled={transitionMutation.isPending}
                className="rounded-md border border-slate-300 px-1 py-0.5 text-xs"
            >
                {BOARD_COLUMNS.map((column) => (
                    <option key={column.status} value={column.status}>
                        {column.label}
                    </option>
                ))}
            </select>
            {nextStatus?.suggested && (
                <button
                    type="button"
                    disabled={transitionMutation.isPending}
                    onClick={() => transitionMutation.mutate(nextStatus.suggested as TaskStatus)}
                    className="text-xs text-sky-600 hover:underline whitespace-nowrap"
                >
                    → {statusLabel(nextStatus.suggested)}
                </button>
            )}
        </div>
    );
}

interface ListViewProps {
    /** Ticket 11: pre-sets the role-based relevance filter server-side ("my_queue=true").
     * Renders the same component, no separate screen (docs/tickets/minhas-tarefas-fila-avaliacao.md). */
    presetMyQueue?: boolean;
}

export default function ListView({ presetMyQueue = false }: ListViewProps) {
    const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
    const sentinelRef = useRef<HTMLDivElement | null>(null);

    const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
        queryKey: ["tasks", "search", { presetMyQueue, ...filters }],
        queryFn: ({ pageParam }) =>
            searchTasks({
                collaboratorIds: filters.collaboratorIds.length ? filters.collaboratorIds : undefined,
                priorities: filters.priorities.length ? filters.priorities : undefined,
                type: filters.type || undefined,
                labelIds: filters.labelIds.length ? filters.labelIds : undefined,
                projectEpicoLabelId: filters.projectEpicoLabelId || undefined,
                tags: filters.tags.length ? filters.tags : undefined,
                q: filters.q || undefined,
                cursor: pageParam,
                limit: PAGE_SIZE,
                myQueue: presetMyQueue || undefined,
            }),
        initialPageParam: undefined as string | undefined,
        getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
    });

    const flatTasks = useMemo(() => data?.pages.flatMap((page) => page.tasks) ?? [], [data]);

    const grouped = useMemo(() => {
        const byStatus = new Map<TaskStatus, Task[]>();
        for (const { status } of BOARD_COLUMNS) byStatus.set(status, []);
        for (const task of flatTasks) byStatus.get(task.status)?.push(task);
        for (const [, list] of byStatus) {
            list.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
        }
        return byStatus;
    }, [flatTasks]);

    const facets = useMemo(() => distinctFacets(flatTasks), [flatTasks]);

    useEffect(() => {
        const sentinel = sentinelRef.current;
        if (!sentinel) return;
        const observer = new IntersectionObserver((entries) => {
            if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
                void fetchNextPage();
            }
        });
        observer.observe(sentinel);
        return () => observer.disconnect();
    }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

    return (
        <div className="min-h-screen p-6 bg-slate-50">
            <div className="flex items-center justify-between mb-4">
                <h1 className="text-xl font-bold text-slate-800">
                    {presetMyQueue ? "Minhas Tarefas / Fila de Avaliação" : "Visão em Lista"}
                </h1>
                <div className="flex items-center gap-3">
                    {presetMyQueue ? (
                        <Link to="/list" className="text-sm text-sky-600 hover:underline">
                            Ver Lista Completa
                        </Link>
                    ) : (
                        <Link to="/my-queue" className="text-sm text-sky-600 hover:underline">
                            Minha Fila
                        </Link>
                    )}
                    <Link to="/board" className="text-sm text-sky-600 hover:underline">
                        Ver Board
                    </Link>
                </div>
            </div>

            <div className="flex flex-wrap gap-3 mb-4 bg-white p-3 rounded-lg border border-slate-200">
                <input
                    aria-label="Buscar por título, descrição ou chave"
                    placeholder="Buscar..."
                    value={filters.q}
                    onChange={(event) => setFilters((f) => ({ ...f, q: event.target.value }))}
                    className="rounded-md border border-slate-300 px-2 py-1 text-sm"
                />

                <select
                    aria-label="Tipo"
                    value={filters.type}
                    onChange={(event) =>
                        setFilters((f) => ({ ...f, type: event.target.value as Task["type"] | "" }))
                    }
                    className="rounded-md border border-slate-300 px-2 py-1 text-sm"
                >
                    <option value="">Todos os tipos</option>
                    {TYPES.map((type) => (
                        <option key={type} value={type}>
                            {type}
                        </option>
                    ))}
                </select>

                <fieldset className="flex items-center gap-2 text-sm">
                    <legend className="sr-only">Prioridade</legend>
                    {PRIORITIES.map((priority) => (
                        <label key={priority} className="flex items-center gap-1">
                            <input
                                type="checkbox"
                                checked={filters.priorities.includes(priority)}
                                onChange={() =>
                                    setFilters((f) => ({ ...f, priorities: toggle(f.priorities, priority) }))
                                }
                            />
                            {priority}
                        </label>
                    ))}
                </fieldset>

                <fieldset className="flex items-center gap-2 text-sm">
                    <legend className="sr-only">Colaborador</legend>
                    <label className="flex items-center gap-1">
                        <input
                            type="checkbox"
                            checked={filters.collaboratorIds.includes(UNASSIGNED)}
                            onChange={() =>
                                setFilters((f) => ({
                                    ...f,
                                    collaboratorIds: toggle(f.collaboratorIds, UNASSIGNED),
                                }))
                            }
                        />
                        Não atribuído
                    </label>
                    {facets.collaborators.map((collaborator) => (
                        <label key={collaborator.id} className="flex items-center gap-1">
                            <input
                                type="checkbox"
                                checked={filters.collaboratorIds.includes(collaborator.id)}
                                onChange={() =>
                                    setFilters((f) => ({
                                        ...f,
                                        collaboratorIds: toggle(f.collaboratorIds, collaborator.id),
                                    }))
                                }
                            />
                            {collaborator.name}
                        </label>
                    ))}
                </fieldset>

                {facets.labels.length > 0 && (
                    <fieldset className="flex items-center gap-2 text-sm">
                        <legend className="sr-only">Labels</legend>
                        {facets.labels.map((label) => (
                            <label key={label.id} className="flex items-center gap-1">
                                <input
                                    type="checkbox"
                                    checked={filters.labelIds.includes(label.id)}
                                    onChange={() =>
                                        setFilters((f) => ({ ...f, labelIds: toggle(f.labelIds, label.id) }))
                                    }
                                />
                                {label.name}
                            </label>
                        ))}
                    </fieldset>
                )}

                {facets.tags.length > 0 && (
                    <fieldset className="flex items-center gap-2 text-sm">
                        <legend className="sr-only">Tags</legend>
                        {facets.tags.map((tag) => (
                            <label key={tag} className="flex items-center gap-1">
                                <input
                                    type="checkbox"
                                    checked={filters.tags.includes(tag)}
                                    onChange={() => setFilters((f) => ({ ...f, tags: toggle(f.tags, tag) }))}
                                />
                                {tag}
                            </label>
                        ))}
                    </fieldset>
                )}
            </div>

            <div className="bg-white rounded-lg border border-slate-200 divide-y divide-slate-100">
                {BOARD_COLUMNS.map(({ status, label }) => {
                    const tasksForStatus = grouped.get(status) ?? [];
                    if (tasksForStatus.length === 0) return null;
                    return (
                        <section key={status} aria-label={label}>
                            <h2 className="px-4 py-2 text-sm font-semibold text-slate-600 bg-slate-50">
                                {label}
                            </h2>
                            <table className="w-full text-sm">
                                <tbody>
                                    {tasksForStatus.map((task) => (
                                        <tr key={task.id} role="row" aria-label={task.title}>
                                            <td className="px-4 py-2">
                                                <Link
                                                    to={`/tasks/${task.id}`}
                                                    className="font-medium text-slate-800 hover:underline hover:text-sky-600"
                                                >
                                                    {task.title}
                                                </Link>
                                                <span className="ml-2 text-xs font-mono text-slate-400">
                                                    {task.task_key}
                                                </span>
                                            </td>
                                            <td className="px-4 py-2">{task.priority}</td>
                                            <td className="px-4 py-2">{task.type}</td>
                                            <td className="px-4 py-2">
                                                {task.labels.map((l) => l.name).join(", ")}
                                                {task.tags && task.tags.length > 0
                                                    ? ` ${task.tags.join(", ")}`
                                                    : ""}
                                            </td>
                                            <td className="px-4 py-2">
                                                <CollaboratorAvatars collaborators={task.collaborators} />
                                            </td>
                                            <td className="px-4 py-2">{task.due_date ?? "—"}</td>
                                            <td className="px-4 py-2">{task.return_count}</td>
                                            <td className="px-4 py-2">{task.created_at}</td>
                                            <td className="px-4 py-2">{task.updated_at}</td>
                                            <td className="px-4 py-2">
                                                <BlockedByBadge blockedBy={task.blocked_by} />
                                            </td>
                                            <td className="px-4 py-2">
                                                <InlineStatusChanger task={task} />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </section>
                    );
                })}
            </div>

            <div ref={sentinelRef} data-testid="infinite-scroll-sentinel" className="h-4" />
        </div>
    );
}
