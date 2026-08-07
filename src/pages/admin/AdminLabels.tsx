import { useState } from "react";
import { Link } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiError, createLabel, listLabels, updateLabel } from "@/lib/api";
import { Button } from "@/components/ui/button.tsx";

const LABELS_QUERY_KEY = ["labels"] as const;

export default function AdminLabels() {
    const queryClient = useQueryClient();
    const { data: labels } = useQuery({ queryKey: LABELS_QUERY_KEY, queryFn: listLabels });

    const [name, setName] = useState("");
    const [dimension, setDimension] = useState("");
    const [color, setColor] = useState("#0ea5e9");
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState("");

    const createMutation = useMutation({
        mutationFn: () => createLabel({ name, dimension, color }),
        onSuccess: () => {
            setName("");
            setDimension("");
            void queryClient.invalidateQueries({ queryKey: LABELS_QUERY_KEY });
        },
        onError: (error) => {
            toast.error(error instanceof ApiError ? error.message : "Não foi possível criar a label.");
        },
    });

    const editMutation = useMutation({
        mutationFn: ({ id, name: newName }: { id: string; name: string }) =>
            updateLabel(id, { name: newName }),
        onSuccess: () => {
            setEditingId(null);
            void queryClient.invalidateQueries({ queryKey: LABELS_QUERY_KEY });
        },
        onError: (error) => {
            toast.error(error instanceof ApiError ? error.message : "Não foi possível salvar a label.");
        },
    });

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        createMutation.mutate();
    };

    return (
        <div className="min-h-screen p-6 max-w-3xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-xl font-bold text-slate-800">Labels</h1>
                <Link to="/admin" className="text-sm text-sky-600 hover:underline">
                    Voltar ao Admin
                </Link>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3 bg-white rounded-md border p-4">
                <h2 className="text-sm font-semibold text-slate-700">Nova label</h2>
                <div className="grid grid-cols-3 gap-3">
                    <input
                        aria-label="Nome"
                        placeholder="Nome"
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                        required
                    />
                    <input
                        aria-label="Dimensão"
                        placeholder="Dimensão (ex: Projeto/Epico)"
                        value={dimension}
                        onChange={(event) => setDimension(event.target.value)}
                        className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                        required
                    />
                    <input
                        aria-label="Cor"
                        type="color"
                        value={color}
                        onChange={(event) => setColor(event.target.value)}
                        className="rounded-md border border-slate-300 h-9"
                    />
                </div>
                <Button type="submit" disabled={createMutation.isPending}>
                    Criar label
                </Button>
            </form>

            <table className="w-full text-sm bg-white rounded-md border">
                <thead>
                    <tr className="border-b text-left text-slate-500">
                        <th className="p-2">Nome</th>
                        <th className="p-2">Dimensão</th>
                        <th className="p-2">Cor</th>
                        <th className="p-2" />
                    </tr>
                </thead>
                <tbody>
                    {(labels ?? []).map((label) => (
                        <tr key={label.id} className="border-b last:border-0">
                            {editingId === label.id ? (
                                <>
                                    <td className="p-2">
                                        <input
                                            aria-label={`Editar nome de ${label.name}`}
                                            value={editName}
                                            onChange={(event) => setEditName(event.target.value)}
                                            className="rounded-md border border-slate-300 px-2 py-1 text-sm w-full"
                                        />
                                    </td>
                                    <td className="p-2">{label.dimension}</td>
                                    <td className="p-2">
                                        <span
                                            className="inline-block w-4 h-4 rounded-full align-middle mr-1"
                                            style={{ backgroundColor: label.color }}
                                        />
                                        {label.color}
                                    </td>
                                    <td className="p-2">
                                        <button
                                            type="button"
                                            className="text-sky-600 hover:underline text-xs"
                                            onClick={() =>
                                                editMutation.mutate({ id: label.id, name: editName })
                                            }
                                        >
                                            Salvar
                                        </button>
                                    </td>
                                </>
                            ) : (
                                <>
                                    <td className="p-2">{label.name}</td>
                                    <td className="p-2">{label.dimension}</td>
                                    <td className="p-2">
                                        <span
                                            className="inline-block w-4 h-4 rounded-full align-middle mr-1"
                                            style={{ backgroundColor: label.color }}
                                        />
                                        {label.color}
                                    </td>
                                    <td className="p-2">
                                        <button
                                            type="button"
                                            className="text-sky-600 hover:underline text-xs"
                                            onClick={() => {
                                                setEditingId(label.id);
                                                setEditName(label.name);
                                            }}
                                        >
                                            Editar
                                        </button>
                                    </td>
                                </>
                            )}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
