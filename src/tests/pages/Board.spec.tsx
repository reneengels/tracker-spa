import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
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

describe('Board', () => {
    it('renders all 10 flow columns, in order, with no cards', () => {
        render(<Board/>);

        const headings = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
        expect(headings).toEqual(BOARD_COLUMNS);
    });
});
