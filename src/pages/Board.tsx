import { useState } from "react";
import type { DragEvent, FormEvent } from "react";
import { Link } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createTask, joinTask, leaveTask, listTasks, transitionTask, type Task } from "@/lib/api";
import { ApiError } from "@/lib/api";
import { BOARD_COLUMNS, type TaskStatus } from "@/lib/taskStatus";
import { Button } from "@/components/ui/button.tsx";
import { useAuth } from "@/lib/auth";
import { CollaboratorAvatars } from "@/components/CollaboratorAvatars";
import { BlockedByBadge } from "@/components/BlockedByBadge";

const TASKS_QUERY_KEY = ["tasks"] as const;
const DRAG_DATA_FORMAT = "application/x-factory-task-id";

function TaskCard({ task }: { task: Task }) {
    const { session } = useAuth();
    const queryClient = useQueryClient();
    const currentActorId = session?.actorId ?? null;
    const isCollaborator = currentActorId
        ? task.collaborators.some((collaborator) => collaborator.id === currentActorId)
        : false;

    const collaboratorMutation = useMutation({
        mutationFn: () => (isCollaborator ? leaveTask(task.id) : joinTask(task.id)),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: TASKS_QUERY_KEY });
        },
        onError: (error) => {
            toast.error(
                error instanceof ApiError
                    ? error.message
                    : "Não foi possível atualizar os colaboradores."
            );
        },
    });

    const handleDragStart = (event: DragEvent<HTMLDivElement>) => {
        event.dataTransfer.setData(DRAG_DATA_FORMAT, task.id);
        event.dataTransfer.effectAllowed = "move";
    };

    return (
        <div
            role="article"
            aria-label={task.title}
            draggable
            onDragStart={handleDragStart}
            className="bg-white rounded-md border border-slate-200 shadow-sm p-2 mb-2 cursor-grab active:cursor-grabbing"
        >
            <div className="flex items-start justify-between gap-2">
                <Link
                    to={`/tasks/${task.id}`}
                    draggable={false}
                    onClick={(event) => event.stopPropagation()}
                    className="text-xs font-mono text-slate-400 hover:underline hover:text-sky-600"
                >
                    {task.task_key}
                </Link>
                <BlockedByBadge blockedBy={task.blocked_by} />
            </div>
            <p className="text-sm font-medium text-slate-800">{task.title}</p>
            <div className="mt-2 flex items-center justify-between">
                <CollaboratorAvatars collaborators={task.collaborators} />
                <button
                    type="button"
                    onClick={(event) => {
                        event.stopPropagation();
                        collaboratorMutation.mutate();
                    }}
                    disabled={collaboratorMutation.isPending}
                    className="text-xs font-medium text-sky-600 hover:underline disabled:opacity-50"
                >
                    {isCollaborator ? "Sair" : "Pegar esta tarefa"}
                </button>
            </div>
        </div>
    );
}

function NewTaskForm({ onClose }: { onClose: () => void }) {
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const queryClient = useQueryClient();

    const mutation = useMutation({
        mutationFn: createTask,
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: TASKS_QUERY_KEY });
            onClose();
        },
        onError: (error) => {
            toast.error(error instanceof ApiError ? error.message : "Não foi possível criar a tarefa.");
        },
    });

    const handleSubmit = (event: FormEvent) => {
        event.preventDefault();
        mutation.mutate({ title, description });
    };

    return (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-6 z-50">
            <form
                onSubmit={handleSubmit}
                className="w-full max-w-md bg-white rounded-xl shadow-xl p-6 space-y-4"
            >
                <h2 className="text-lg font-semibold text-slate-800">Nova tarefa</h2>

                <div className="space-y-1">
                    <label htmlFor="task-title" className="text-sm font-medium text-slate-700">
                        Título
                    </label>
                    <input
                        id="task-title"
                        value={title}
                        onChange={(event) => setTitle(event.target.value)}
                        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                        required
                    />
                </div>

                <div className="space-y-1">
                    <label htmlFor="task-description" className="text-sm font-medium text-slate-700">
                        Descrição
                    </label>
                    <textarea
                        id="task-description"
                        value={description}
                        onChange={(event) => setDescription(event.target.value)}
                        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                        rows={3}
                        required
                    />
                </div>

                <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={onClose}>
                        Cancelar
                    </Button>
                    <Button type="submit" disabled={mutation.isPending}>
                        {mutation.isPending ? "Criando..." : "Criar"}
                    </Button>
                </div>
            </form>
        </div>
    );
}

export default function Board() {
    const [isCreating, setIsCreating] = useState(false);
    const queryClient = useQueryClient();

    const { data: tasks = [] } = useQuery({
        queryKey: TASKS_QUERY_KEY,
        queryFn: listTasks,
    });

    const transitionMutation = useMutation({
        mutationFn: ({ taskId, toStatus }: { taskId: string; toStatus: TaskStatus }) =>
            transitionTask(taskId, { to_status: toStatus }),
        onMutate: async ({ taskId, toStatus }) => {
            await queryClient.cancelQueries({ queryKey: TASKS_QUERY_KEY });
            const previousTasks = queryClient.getQueryData<Task[]>(TASKS_QUERY_KEY);
            queryClient.setQueryData<Task[]>(TASKS_QUERY_KEY, (current) =>
                current?.map((task) => (task.id === taskId ? { ...task, status: toStatus } : task))
            );
            return { previousTasks };
        },
        onError: (error, _variables, context) => {
            if (context?.previousTasks) {
                queryClient.setQueryData(TASKS_QUERY_KEY, context.previousTasks);
            }
            toast.error(
                error instanceof ApiError ? error.message : "Não foi possível mover a tarefa."
            );
        },
        onSettled: () => {
            void queryClient.invalidateQueries({ queryKey: TASKS_QUERY_KEY });
        },
    });

    const handleDragOver = (event: DragEvent<HTMLElement>) => {
        event.preventDefault();
    };

    const handleDrop = (toStatus: TaskStatus) => (event: DragEvent<HTMLElement>) => {
        event.preventDefault();
        const taskId = event.dataTransfer.getData(DRAG_DATA_FORMAT);
        if (!taskId) {
            return;
        }
        const task = tasks.find((candidate) => candidate.id === taskId);
        if (!task || task.status === toStatus) {
            return;
        }
        transitionMutation.mutate({ taskId, toStatus });
    };

    return (
        <div className="min-h-screen p-6 bg-slate-50">
            <div className="flex items-center justify-between mb-4">
                <h1 className="text-xl font-bold text-slate-800">Board Kanban</h1>
                <div className="flex items-center gap-4">
                    <Link to="/list" className="text-sm text-sky-600 hover:underline">
                        Ver Lista
                    </Link>
                    <Button onClick={() => setIsCreating(true)}>Nova tarefa</Button>
                </div>
            </div>

            <div className="flex gap-4 overflow-x-auto pb-4">
                {BOARD_COLUMNS.map(({ status, label }) => (
                    <section
                        key={status}
                        aria-label={label}
                        onDragOver={handleDragOver}
                        onDrop={handleDrop(status)}
                        className="min-w-[220px] flex-1 bg-white rounded-lg border border-slate-200 shadow-sm p-3"
                    >
                        <h2 className="text-sm font-semibold text-slate-600 mb-2">{label}</h2>
                        <div className="min-h-[120px]">
                            {tasks
                                .filter((task) => task.status === status)
                                .map((task) => (
                                    <TaskCard key={task.id} task={task} />
                                ))}
                        </div>
                    </section>
                ))}
            </div>

            {isCreating && <NewTaskForm onClose={() => setIsCreating(false)} />}
        </div>
    );
}
