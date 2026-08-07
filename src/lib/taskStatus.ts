export type TaskStatus =
    | "TRIAGEM"
    | "BACKLOG"
    | "FILA"
    | "REWORK"
    | "EM_PROGRESSO"
    | "REVIEW_AGENTICO"
    | "REVIEW_HUMANO"
    | "QA"
    | "PRONTO"
    | "REJEITADO_CANCELADO";

export const BOARD_COLUMNS: ReadonlyArray<{ status: TaskStatus; label: string }> = [
    { status: "TRIAGEM", label: "Triagem" },
    { status: "BACKLOG", label: "Backlog" },
    { status: "FILA", label: "Fila" },
    { status: "REWORK", label: "Rework" },
    { status: "EM_PROGRESSO", label: "Em Progresso" },
    { status: "REVIEW_AGENTICO", label: "Review Agêntico" },
    { status: "REVIEW_HUMANO", label: "Review Humano" },
    { status: "QA", label: "QA" },
    { status: "PRONTO", label: "Pronto" },
    { status: "REJEITADO_CANCELADO", label: "Rejeitado/Cancelado" },
];

const STATUS_LABELS: Record<TaskStatus, string> = Object.fromEntries(
    BOARD_COLUMNS.map(({ status, label }) => [status, label])
) as Record<TaskStatus, string>;

export function statusLabel(status: TaskStatus): string {
    return STATUS_LABELS[status];
}
