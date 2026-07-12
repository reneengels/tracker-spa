const BOARD_COLUMNS = [
    "Triagem",
    "Backlog",
    "Fila",
    "Rework",
    "Em Progresso",
    "Review Agêntico",
    "Review Humano",
    "QA",
    "Pronto",
    "Rejeitado/Cancelado",
] as const;

export default function Board() {
    return (
        <div className="min-h-screen p-6 bg-slate-50">
            <h1 className="text-xl font-bold text-slate-800 mb-4">Board Kanban</h1>
            <div className="flex gap-4 overflow-x-auto pb-4">
                {BOARD_COLUMNS.map((column) => (
                    <section
                        key={column}
                        aria-label={column}
                        className="min-w-[220px] flex-1 bg-white rounded-lg border border-slate-200 shadow-sm p-3"
                    >
                        <h2 className="text-sm font-semibold text-slate-600 mb-2">{column}</h2>
                        <div className="min-h-[120px]" />
                    </section>
                ))}
            </div>
        </div>
    );
}
