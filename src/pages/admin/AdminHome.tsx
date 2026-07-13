import { Link } from "react-router";

export default function AdminHome() {
    return (
        <div className="min-h-screen p-6 max-w-xl mx-auto space-y-4">
            <h1 className="text-xl font-bold text-slate-800">Admin</h1>
            <nav className="flex flex-col gap-2">
                <Link to="/admin/users" className="text-sky-600 hover:underline">
                    Usuários
                </Link>
                <Link to="/admin/labels" className="text-sky-600 hover:underline">
                    Labels
                </Link>
                <Link to="/admin/wip-limits" className="text-sky-600 hover:underline">
                    Limites de WIP
                </Link>
                <Link to="/admin/agent-tokens" className="text-sky-600 hover:underline">
                    Tokens de Agente
                </Link>
                <Link to="/admin/notifications" className="text-sky-600 hover:underline">
                    Notificações
                </Link>
            </nav>
            <Link to="/board" className="text-sm text-slate-500 hover:underline">
                Voltar ao Board
            </Link>
        </div>
    );
}
