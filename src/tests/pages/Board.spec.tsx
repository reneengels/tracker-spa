import { describe } from "vitest";
import { render, screen } from "@testing-library/react";
import Board from "../../pages/Board.tsx";

describe('Board', () => {
    it('should render the Board placeholder', () => {
        render(<Board/>);
        expect(screen.getByText(/Board Kanban placeholder/i)).toBeInTheDocument();
    });
});
