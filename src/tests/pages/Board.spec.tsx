import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import Board from "../../pages/Board.tsx";

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
];

function renderBoard() {
    const queryClient = new QueryClient();
    return render(
        <QueryClientProvider client={queryClient}>
            <MemoryRouter>
                <Board />
            </MemoryRouter>
        </QueryClientProvider>
    );
}

describe('Board', () => {
    it('renders all 10 flow columns, in order, with no cards', async () => {
        renderBoard();

        const headings = await screen.findAllByRole("heading", { level: 2 });
        expect(headings.map((h) => h.textContent)).toEqual(BOARD_COLUMNS);
        expect(screen.queryAllByRole("article")).toHaveLength(0);
    });
});
