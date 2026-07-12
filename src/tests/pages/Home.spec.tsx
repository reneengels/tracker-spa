import { describe } from "vitest";
import { render, screen } from "@testing-library/react";
import Home from "../../pages/Home.tsx";
import { MemoryRouter } from "react-router";

describe('Home', () => {
    it('should render the Home component', () => {
        render(
            <MemoryRouter>
                <Home/>
            </MemoryRouter>
        );
        expect(screen.getByText(/Vite \+ React/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /count/i })).toBeInTheDocument();
    });
});