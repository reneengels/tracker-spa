import * as React from "react";
import { createContext, useContext, useMemo, useState } from "react";
import { decodeJwtClaims, type SessionRole } from "@/lib/jwt";
import type { LoginResponse } from "@/lib/api";

const ACCESS_TOKEN_KEY = "factory.accessToken";
const REFRESH_TOKEN_KEY = "factory.refreshToken";

interface Session {
    accessToken: string;
    refreshToken: string;
    role: SessionRole | null;
}

interface AuthContextValue {
    session: Session | null;
    isAuthenticated: boolean;
    setSession: (response: LoginResponse) => void;
    clearSession: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readStoredSession(): Session | null {
    const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    if (!accessToken || !refreshToken) {
        return null;
    }
    const claims = decodeJwtClaims(accessToken);
    return { accessToken, refreshToken, role: claims?.role ?? null };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [session, setSessionState] = useState<Session | null>(() => readStoredSession());

    const setSession = (response: LoginResponse) => {
        localStorage.setItem(ACCESS_TOKEN_KEY, response.access_token);
        localStorage.setItem(REFRESH_TOKEN_KEY, response.refresh_token);
        const claims = decodeJwtClaims(response.access_token);
        setSessionState({
            accessToken: response.access_token,
            refreshToken: response.refresh_token,
            role: claims?.role ?? null,
        });
    };

    const clearSession = () => {
        localStorage.removeItem(ACCESS_TOKEN_KEY);
        localStorage.removeItem(REFRESH_TOKEN_KEY);
        setSessionState(null);
    };

    const value = useMemo<AuthContextValue>(
        () => ({
            session,
            isAuthenticated: session !== null,
            setSession,
            clearSession,
        }),
        [session]
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components -- hook lives alongside its provider by design
export function useAuth(): AuthContextValue {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
}
