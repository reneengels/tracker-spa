import { useState } from "react";
import { useNavigate } from "react-router";
import { useMutation } from "@tanstack/react-query";
import { login } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button.tsx";

export default function Login() {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const { setSession } = useAuth();
    const navigate = useNavigate();

    const mutation = useMutation({
        mutationFn: login,
        onSuccess: (response) => {
            setSession(response);
            void navigate("/board");
        },
    });

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        mutation.mutate({ username, password });
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-sky-50 via-white to-rose-50">
            <form
                onSubmit={handleSubmit}
                className="w-full max-w-sm bg-white/70 backdrop-blur-md rounded-2xl shadow-xl p-8 space-y-4"
            >
                <h1 className="text-2xl font-bold text-slate-800">Factory</h1>

                <div className="space-y-1">
                    <label htmlFor="username" className="text-sm font-medium text-slate-700">
                        Usuário
                    </label>
                    <input
                        id="username"
                        name="username"
                        type="text"
                        autoComplete="username"
                        value={username}
                        onChange={(event) => setUsername(event.target.value)}
                        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                        required
                    />
                </div>

                <div className="space-y-1">
                    <label htmlFor="password" className="text-sm font-medium text-slate-700">
                        Senha
                    </label>
                    <input
                        id="password"
                        name="password"
                        type="password"
                        autoComplete="current-password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                        required
                    />
                </div>

                {mutation.isError && (
                    <p role="alert" className="text-sm text-red-600">
                        Usuário ou senha inválidos.
                    </p>
                )}

                <Button type="submit" className="w-full" disabled={mutation.isPending}>
                    {mutation.isPending ? "Entrando..." : "Entrar"}
                </Button>
            </form>
        </div>
    );
}
