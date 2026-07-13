import type { Task } from "@/lib/api";

function initials(name: string): string {
    return name
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join("");
}

export function CollaboratorAvatars({ collaborators }: { collaborators: Task["collaborators"] }) {
    if (collaborators.length === 0) {
        return <span className="text-xs text-slate-400">Sem colaboradores</span>;
    }
    return (
        <div className="flex -space-x-2">
            {collaborators.map((collaborator) => (
                <span
                    key={collaborator.id}
                    role="img"
                    aria-label={`${collaborator.name} (${collaborator.type === "ai_agent" ? "agente" : "humano"})`}
                    title={collaborator.name}
                    className={`inline-flex h-6 w-6 items-center justify-center rounded-full border-2 border-white text-[10px] font-semibold text-white ${
                        collaborator.type === "ai_agent" ? "bg-violet-500" : "bg-sky-500"
                    }`}
                >
                    {initials(collaborator.name)}
                </span>
            ))}
        </div>
    );
}
