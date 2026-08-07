import { useState } from "react";
import { Link } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiError, listWorkflowConfig, updateWorkflowConfig } from "@/lib/api";
import type { WorkflowConfigEntry } from "@/lib/api";
import { BOARD_COLUMNS } from "@/lib/taskStatus";

const WIP_QUERY_KEY = ["admin", "workflow-config"] as const;

function WipLimitRow({ entry }: { entry: WorkflowConfigEntry }) {
    const queryClient = useQueryClient();
    const [value, setValue] = useState(entry.wip_limit === null ? "" : String(entry.wip_limit));

    const mutation = useMutation({
        mutationFn: (wipLimit: number | null) => updateWorkflowConfig(entry.status, wipLimit),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: WIP_QUERY_KEY });
        },
        onError: (error) => {
            toast.error(
                error instanceof ApiError ? error.message : "Não foi possível salvar o limite de WIP."
            );
        },
    });

    const label = BOARD_COLUMNS.find((column) => column.status === entry.status)?.label ?? entry.status;

    const handleSave = () => {
        const wipLimit = value.trim() === "" ? null : Number(value);
        mutation.mutate(wipLimit);
    };

    return (
        <tr className="border-b last:border-0">
            <td className="p-2">{label}</td>
            <td className="p-2">
                <input
                    aria-label={`Limite de WIP para ${label}`}
                    type="number"
                    min={0}
                    value={value}
                    onChange={(event) => setValue(event.target.value)}
                    placeholder="Sem limite"
                    className="rounded-md border border-slate-300 px-2 py-1 text-sm w-28"
                />
            </td>
            <td className="p-2">
                <button
                    type="button"
                    className="text-sky-600 hover:underline text-xs"
                    onClick={handleSave}
                    disabled={mutation.isPending}
                >
                    Salvar
                </button>
            </td>
        </tr>
    );
}

export default function AdminWipLimits() {
    const { data: entries } = useQuery({ queryKey: WIP_QUERY_KEY, queryFn: listWorkflowConfig });

    const orderedEntries = BOARD_COLUMNS.map(
        (column) =>
            (entries ?? []).find((entry) => entry.status === column.status) ?? {
                status: column.status,
                wip_limit: null,
            }
    );

    return (
        <div className="min-h-screen p-6 max-w-2xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-xl font-bold text-slate-800">Limites de WIP</h1>
                <Link to="/admin" className="text-sm text-sky-600 hover:underline">
                    Voltar ao Admin
                </Link>
            </div>
            <p className="text-sm text-slate-500">
                Deixe em branco para nenhum limite configurado (não bloqueia liberação para a Fila).
            </p>
            <table className="w-full text-sm bg-white rounded-md border">
                <thead>
                    <tr className="border-b text-left text-slate-500">
                        <th className="p-2">Status</th>
                        <th className="p-2">Limite de WIP</th>
                        <th className="p-2" />
                    </tr>
                </thead>
                <tbody>
                    {orderedEntries.map((entry) => (
                        <WipLimitRow key={entry.status} entry={entry} />
                    ))}
                </tbody>
            </table>
        </div>
    );
}
