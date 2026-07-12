import * as React from "react";
import { createContext, useContext, useMemo, useState } from "react";
import { decodeJwtClaims, type SessionRole } from "@/lib/jwt";
import { clearTokens, getAccessToken, getRefreshToken, setTokens } from "@/lib/tokenStorage";
import type { LoginResponse } from "@/lib/api";

interface Session {
    accessToken: string;
    refreshToken: string;
    role: SessionRole | null;
    actorId: string | null;
}

interface AuthContextValue {
    session: Session | null;
    isAuthenticated: boolean;
    setSession: (response: LoginResponse) => void;
    clearSession: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readStoredSession(): Session | null {
    const accessToken = getAccessToken();
    const refreshToken = getRefreshToken();
    if (!accessToken || !refreshToken) {
        return null;
    }
    const claims = decodeJwtClaims(accessToken);
    return {
        accessToken,
        refreshToken,
        role: claims?.role ?? null,
        actorId: claims?.sub ?? null,
    };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [session, setSessionState] = useState<Session | null>(() => readStoredSession());

    const setSession = (response: LoginResponse) => {
        setTokens(response.access_token, response.refresh_token);
        const claims = decodeJwtClaims(response.access_token);
        setSessionState({
            accessToken: response.access_token,
            refreshToken: response.refresh_token,
            role: claims?.role ?? null,
            actorId: claims?.sub ?? null,
        });
    };

    const clearSession = () => {
        clearTokens();
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
