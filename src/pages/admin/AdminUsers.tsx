import { useState } from "react";
import { Link } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiError, createUser, listUsers, updateUser } from "@/lib/api";
import type { AdminUser, CreateUserRequest } from "@/lib/api";
import { Button } from "@/components/ui/button.tsx";

const ROLES: AdminUser["role"][] = ["PO", "Dev", "QA", "Admin", "AI_Agent"];

const USERS_QUERY_KEY = ["admin", "users"] as const;

export default function AdminUsers() {
    const queryClient = useQueryClient();
    const { data: users } = useQuery({ queryKey: USERS_QUERY_KEY, queryFn: listUsers });

    const [name, setName] = useState("");
    const [type, setType] = useState<AdminUser["type"]>("human");
    const [role, setRole] = useState<AdminUser["role"]>("Dev");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const createMutation = useMutation({
        mutationFn: (input: CreateUserRequest) => createUser(input),
        onSuccess: () => {
            setName("");
            setEmail("");
            setPassword("");
            void queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY });
        },
        onError: (error) => {
            toast.error(error instanceof ApiError ? error.message : "Não foi possível criar o usuário.");
        },
    });

    const toggleActiveMutation = useMutation({
        mutationFn: ({ id, active }: { id: string; active: boolean }) => updateUser(id, { active }),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY });
        },
        onError: (error) => {
            toast.error(error instanceof ApiError ? error.message : "Não foi possível salvar o usuário.");
        },
    });

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        createMutation.mutate({
            name,
            type,
            role,
            email: email || undefined,
            password: type === "human" ? password : undefined,
        });
    };

    return (
        <div className="min-h-screen p-6 max-w-3xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-xl font-bold text-slate-800">Usuários</h1>
                <Link to="/admin" className="text-sm text-sky-600 hover:underline">
                    Voltar ao Admin
                </Link>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3 bg-white rounded-md border p-4">
                <h2 className="text-sm font-semibold text-slate-700">Novo usuário</h2>
                <div className="grid grid-cols-2 gap-3">
                    <input
                        aria-label="Nome"
                        placeholder="Nome"
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                        required
                    />
                    <input
                        aria-label="Email"
                        placeholder="Email (opcional)"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                    />
                    <select
                        aria-label="Tipo"
                        value={type}
                        onChange={(event) => setType(event.target.value as AdminUser["type"])}
                        className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                    >
                        <option value="human">Humano</option>
                        <option value="ai_agent">Agente de IA</option>
                    </select>
                    <select
                        aria-label="Papel"
                        value={role}
                        onChange={(event) => setRole(event.target.value as AdminUser["role"])}
                        className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                    >
                        {ROLES.map((r) => (
                            <option key={r} value={r}>
                                {r}
                            </option>
                        ))}
                    </select>
                    {type === "human" && (
                        <input
                            aria-label="Senha"
                            type="password"
                            placeholder="Senha"
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                            className="rounded-md border border-slate-300 px-3 py-2 text-sm col-span-2"
                            required
                        />
                    )}
                </div>
                <Button type="submit" disabled={createMutation.isPending}>
                    Criar usuário
                </Button>
            </form>

            <table className="w-full text-sm bg-white rounded-md border">
                <thead>
                    <tr className="border-b text-left text-slate-500">
                        <th className="p-2">Nome</th>
                        <th className="p-2">Tipo</th>
                        <th className="p-2">Papel</th>
                        <th className="p-2">Ativo</th>
                        <th className="p-2" />
                    </tr>
                </thead>
                <tbody>
                    {(users ?? []).map((user) => (
                        <tr key={user.id} className="border-b last:border-0">
                            <td className="p-2">{user.name}</td>
                            <td className="p-2">{user.type === "human" ? "Humano" : "Agente de IA"}</td>
                            <td className="p-2">{user.role}</td>
                            <td className="p-2">{user.active ? "Sim" : "Não"}</td>
                            <td className="p-2">
                                <button
                                    type="button"
                                    className="text-sky-600 hover:underline text-xs"
                                    onClick={() =>
                                        toggleActiveMutation.mutate({ id: user.id, active: !user.active })
                                    }
                                >
                                    {user.active ? "Desativar" : "Ativar"}
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
