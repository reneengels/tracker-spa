import type { ReactNode } from "react";
import { Navigate } from "react-router";
import { useAuth } from "@/lib/auth";
import type { SessionRole } from "@/lib/jwt";

export default function RequireRole({
    role,
    children,
}: {
    role: SessionRole;
    children: ReactNode;
}) {
    const { isAuthenticated, session } = useAuth();

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    if (session?.role !== role) {
        return (
            <div className="min-h-screen flex items-center justify-center p-6">
                <p role="alert" className="text-slate-600">
                    Você não tem permissão para acessar esta página.
                </p>
            </div>
        );
    }

    return <>{children}</>;
}
