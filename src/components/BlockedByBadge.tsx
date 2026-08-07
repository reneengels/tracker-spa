import type { Task } from "@/lib/api";

export function BlockedByBadge({ blockedBy }: { blockedBy: Task["blocked_by"] }) {
    if (blockedBy.length === 0) {
        return null;
    }
    const tooltip = `Bloqueada por: ${blockedBy.map((blocker) => blocker.task_key).join(", ")}`;
    return (
        <span
            role="img"
            aria-label={tooltip}
            title={tooltip}
            className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700"
        >
            ⛔ {blockedBy.length}
        </span>
    );
}
