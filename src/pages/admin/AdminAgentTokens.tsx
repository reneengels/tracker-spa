import { useState } from "react";
import { Link } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiError, createAgentToken, listAgentTokens, listUsers, revokeAgentToken } from "@/lib/api";
import { Button } from "@/components/ui/button.tsx";

const TOKENS_QUERY_KEY = ["admin", "agent-tokens"] as const;
const USERS_QUERY_KEY = ["admin", "users"] as const;

const KNOWN_TOOLS = [
    "list_backlog",
    "claim_task",
    "get_task_detail",
    "add_comment",
    "attach_code_artifact",
    "move_status",
    "create_task_as_po",
    "list_my_tasks",
];

export default function AdminAgentTokens() {
    const queryClient = useQueryClient();
    const { data: tokens } = useQuery({ queryKey: TOKENS_QUERY_KEY, queryFn: listAgentTokens });
    const { data: users } = useQuery({ queryKey: USERS_QUERY_KEY, queryFn: listUsers });
    const agentActors = (users ?? []).filter((user) => user.type === "ai_agent");

    const [actorId, setActorId] = useState("");
    const [scope, setScope] = useState<string[]>([]);
    const [newToken, setNewToken] = useState<string | null>(null);

    const createMutation = useMutation({
        mutationFn: () => createAgentToken({ actor_id: actorId, scope }),
        onSuccess: (created) => {
            setNewToken(created.token);
            setScope([]);
            void queryClient.invalidateQueries({ queryKey: TOKENS_QUERY_KEY });
        },
        onError: (error) => {
            toast.error(error instanceof ApiError ? error.message : "Não foi possível criar o token.");
        },
    });

    const revokeMutation = useMutation({
        mutationFn: (id: string) => revokeAgentToken(id),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: TOKENS_QUERY_KEY });
        },
        onError: (error) => {
            toast.error(error instanceof ApiError ? error.message : "Não foi possível revogar o token.");
        },
    });

    const toggleTool = (tool: string) => {
        setScope((current) =>
            current.includes(tool) ? current.filter((t) => t !== tool) : [...current, tool]
        );
    };

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        createMutation.mutate();
    };

    return (
        <div className="min-h-screen p-6 max-w-3xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-xl font-bold text-slate-800">Tokens de Agente</h1>
                <Link to="/admin" className="text-sm text-sky-600 hover:underline">
                    Voltar ao Admin
                </Link>
            </div>

            {newToken && (
                <div role="alert" className="rounded-md border border-amber-400 bg-amber-50 p-4 space-y-2">
                    <p className="text-sm font-semibold text-amber-800">
                        Copie este token agora — ele não será mostrado novamente.
                    </p>
                    <code className="block text-xs bg-white p-2 rounded border break-all">{newToken}</code>
                    <button
                        type="button"
                        className="text-xs text-sky-600 hover:underline"
                        onClick={() => setNewToken(null)}
                    >
                        Ok, já copiei
                    </button>
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3 bg-white rounded-md border p-4">
                <h2 className="text-sm font-semibold text-slate-700">Novo token</h2>
                <select
                    aria-label="Agente"
                    value={actorId}
                    onChange={(event) => setActorId(event.target.value)}
                    className="rounded-md border border-slate-300 px-3 py-2 text-sm w-full"
                    required
                >
                    <option value="">Selecione um agente...</option>
                    {agentActors.map((agent) => (
                        <option key={agent.id} value={agent.id}>
                            {agent.name}
                        </option>
                    ))}
                </select>
                <fieldset className="space-y-1">
                    <legend className="text-xs text-slate-500">Escopo (tools permitidas)</legend>
                    <div className="grid grid-cols-2 gap-1">
                        {KNOWN_TOOLS.map((tool) => (
                            <label key={tool} className="flex items-center gap-2 text-sm">
                                <input
                                    type="checkbox"
                                    checked={scope.includes(tool)}
                                    onChange={() => toggleTool(tool)}
                                />
                                {tool}
                            </label>
                        ))}
                    </div>
                </fieldset>
                <Button type="submit" disabled={createMutation.isPending || !actorId}>
                    Criar token
                </Button>
            </form>

            <table className="w-full text-sm bg-white rounded-md border">
                <thead>
                    <tr className="border-b text-left text-slate-500">
                        <th className="p-2">Agente</th>
                        <th className="p-2">Escopo</th>
                        <th className="p-2">Ativo</th>
                        <th className="p-2" />
                    </tr>
                </thead>
                <tbody>
                    {(tokens ?? []).map((token) => (
                        <tr key={token.id} className="border-b last:border-0">
                            <td className="p-2">{token.actor_name}</td>
                            <td className="p-2 text-xs">{token.scope.join(", ")}</td>
                            <td className="p-2">{token.active ? "Sim" : "Não"}</td>
                            <td className="p-2">
                                {token.active && (
                                    <button
                                        type="button"
                                        className="text-red-600 hover:underline text-xs"
                                        onClick={() => revokeMutation.mutate(token.id)}
                                    >
                                        Revogar
                                    </button>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
