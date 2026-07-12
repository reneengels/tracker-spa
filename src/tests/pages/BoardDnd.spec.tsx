import { describe, it, expect } from "vitest";
import { render, screen, within, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { http, HttpResponse } from "msw";
import { server } from "../mocks/server";
import { resetTasks, makeTask } from "../mocks/handlers";
import Board from "../../pages/Board.tsx";

function createDataTransfer() {
    const store = new Map<string, string>();
    return {
        setData: (format: string, data: string) => store.set(format, data),
        getData: (format: string) => store.get(format) ?? "",
        effectAllowed: "",
    } as unknown as DataTransfer;
}

function renderBoard() {
    const queryClient = new QueryClient();
    return render(
        <QueryClientProvider client={queryClient}>
            <Toaster />
            <Board />
        </QueryClientProvider>
    );
}

function dragCardToColumn(cardLabel: string, columnLabel: string) {
    const card = screen.getByRole("article", { name: cardLabel });
    const column = screen.getByRole("region", { name: columnLabel });
    const dataTransfer = createDataTransfer();

    fireEvent.dragStart(card, { dataTransfer });
    fireEvent.dragOver(column, { dataTransfer });
    fireEvent.drop(column, { dataTransfer });
}

describe("Board drag-and-drop", () => {
    it("moves a card to a valid column and persists the new status", async () => {
        resetTasks([makeTask({ id: "task-1", task_key: "FAC-1", title: "Escrever specs", status: "TRIAGEM" })]);
        renderBoard();

        await screen.findByRole("article", { name: "Escrever specs" });

        dragCardToColumn("Escrever specs", "Backlog");

        await waitFor(() => {
            expect(
                within(screen.getByRole("region", { name: "Backlog" })).getByText("FAC-1")
            ).toBeInTheDocument();
        });
        expect(
            within(screen.getByRole("region", { name: "Triagem" })).queryByText("FAC-1")
        ).not.toBeInTheDocument();
    });

    it("reverts a card to its original column and shows the reason when the backend rejects the transition", async () => {
        resetTasks([makeTask({ id: "task-1", task_key: "FAC-1", title: "Escrever specs", status: "TRIAGEM" })]);
        server.use(
            http.post("http://localhost:8000/tasks/:id/transitions", () =>
                HttpResponse.json(
                    {
                        success: false,
                        error_code: "INVALID_TRANSITION",
                        message: "Não é possível mover de Triagem para Pronto diretamente.",
                    },
                    { status: 409 }
                )
            )
        );
        renderBoard();

        await screen.findByRole("article", { name: "Escrever specs" });

        dragCardToColumn("Escrever specs", "Pronto");

        expect(
            await screen.findByText("Não é possível mover de Triagem para Pronto diretamente.")
        ).toBeInTheDocument();
        await waitFor(() => {
            expect(
                within(screen.getByRole("region", { name: "Triagem" })).getByText("FAC-1")
            ).toBeInTheDocument();
        });
        expect(
            within(screen.getByRole("region", { name: "Pronto" })).queryByText("FAC-1")
        ).not.toBeInTheDocument();
    });
});
