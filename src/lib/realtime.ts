import type { QueryClient } from "@tanstack/react-query";
import { getAccessToken } from "@/lib/tokenStorage";

const API_BASE_URL: string =
    (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:8000";

const TASKS_QUERY_KEY = ["tasks"] as const;
const taskQueryKey = (taskId: string) => ["task", taskId] as const;

interface StatusTransitionEvent {
    event: "status_transition";
    task_id: string;
    from_status: string;
    to_status: string;
    actor_id: string;
}

interface CommentCreatedEvent {
    event: "comment_created";
    task_id: string;
    comment_id: string;
    author_id: string;
    created_at: string;
    transition_id: string | null;
}

type RealtimeEvent = StatusTransitionEvent | CommentCreatedEvent;

function isRealtimeEvent(value: unknown): value is RealtimeEvent {
    return (
        typeof value === "object" &&
        value !== null &&
        "event" in value &&
        (value.event === "status_transition" || value.event === "comment_created")
    );
}

/** Reconciles the query cache in response to a server-pushed realtime event. */
export function handleRealtimeEvent(queryClient: QueryClient, raw: string): void {
    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        return;
    }
    if (!isRealtimeEvent(parsed)) {
        return;
    }

    void queryClient.invalidateQueries({ queryKey: TASKS_QUERY_KEY });
    void queryClient.invalidateQueries({ queryKey: taskQueryKey(parsed.task_id) });
}

function wsUrl(): string {
    const base = new URL(API_BASE_URL);
    base.protocol = base.protocol === "https:" ? "wss:" : "ws:";
    base.pathname = "/ws";
    const token = getAccessToken();
    if (token) {
        base.searchParams.set("token", token);
    }
    return base.toString();
}

/**
 * Opens the realtime connection and wires incoming messages to query cache
 * invalidation. Returns a cleanup function that closes the connection.
 *
 * `wsFactory` defaults to the real `WebSocket` constructor but accepts a
 * fake in tests, so the reconciliation logic (`handleRealtimeEvent`) can be
 * exercised without a real WebSocket server.
 */
export function connectRealtime(
    queryClient: QueryClient,
    wsFactory: (url: string) => WebSocket = (url) => new WebSocket(url)
): () => void {
    let socket: WebSocket | null = null;
    let closedByCaller = false;
    let retryTimeout: ReturnType<typeof setTimeout> | undefined;

    function open() {
        if (closedByCaller) {
            return;
        }
        socket = wsFactory(wsUrl());
        socket.onmessage = (event: MessageEvent) => {
            handleRealtimeEvent(queryClient, event.data as string);
        };
        socket.onclose = () => {
            if (!closedByCaller) {
                retryTimeout = setTimeout(open, 3000);
            }
        };
    }

    open();

    return () => {
        closedByCaller = true;
        if (retryTimeout) {
            clearTimeout(retryTimeout);
        }
        socket?.close();
    };
}
