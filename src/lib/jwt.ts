export type SessionRole = "PO" | "Dev" | "QA" | "Admin" | "AI_Agent";

export interface JwtClaims {
    sub?: string;
    role?: SessionRole;
    exp?: number;
    [key: string]: unknown;
}

function base64UrlDecode(segment: string): string {
    const normalized = segment.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(
        normalized.length + ((4 - (normalized.length % 4)) % 4),
        "="
    );
    return atob(padded);
}

/** Decodes a JWT's payload without verifying its signature — for display purposes only, never for authorization decisions. */
export function decodeJwtClaims(token: string): JwtClaims | null {
    const parts = token.split(".");
    if (parts.length !== 3) {
        return null;
    }

    try {
        return JSON.parse(base64UrlDecode(parts[1])) as JwtClaims;
    } catch {
        return null;
    }
}
