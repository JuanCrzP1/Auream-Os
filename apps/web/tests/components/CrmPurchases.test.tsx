import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { CrmPage } from "../../src/features/crm/pages/CrmPage";
import { BOARD, card, stubCrmApi } from "../helpers/crmApi";

// ---------------------------------------------------------------------------
// Un negocio por cada compra: la tarjeta dice qué compra es y cuánto lleva el
// cliente; las compras anteriores no se mueven; los números de recompra; y
// la ficha con sus compras.
// ---------------------------------------------------------------------------

const page = () => render(<MemoryRouter initialEntries={["/crm"]}><CrmPage /></MemoryRouter>);

const WITH_PURCHASES = {
  ...BOARD,
  columns: BOARD.columns.map((column) =>
    column.stageId === "s1"
      ? { ...column, cards: [card({ contactId: "c9", dealId: "d9", name: "María Pérez", stageId: "s1", number: 2, boughtTotal: { amount: 49900, currency: "COP" } })] }
      : column.stageId === "s3"
        ? { ...column, cards: [card({ contactId: "c9", dealId: "d8", name: "María Pérez", stageId: "s3", number: 1, current: false })] }
        : column
  )
};

beforeEach(() => vi.restoreAllMocks());

describe("CRM · varias compras por cliente", () => {
  it("la recompra se marca con su número y lo que lleva; la compra anterior no se mueve", async () => {
    stubCrmApi({ board: WITH_PURCHASES });
    page();
    const nuevo = await screen.findByRole("region", { name: "Nuevo: 3" });
    expect(within(nuevo).getByText("2.ª compra")).toBeInTheDocument();
    expect(within(nuevo).getByText(/lleva \$ 49\.900/)).toBeInTheDocument();
    expect(within(nuevo).getByRole("button", { name: "Mover a María Pérez" })).toBeInTheDocument();

    const past = screen.getByRole("region", { name: "Pagó: 1" });
    expect(within(past).getByText("1.ª compra · anterior")).toBeInTheDocument();
    expect(within(past).queryByRole("button", { name: "Mover a María Pérez" })).not.toBeInTheDocument();
  });

  it("los números de recompra y la ficha con sus compras", async () => {
    stubCrmApi();
    page();
    const stats = await screen.findByRole("region", { name: "Resumen del embudo" });
    expect(within(stats).getByText("22 de cada 100")).toBeInTheDocument();
    expect(within(stats).getByText("$ 71.800 COP")).toBeInTheDocument();

    await userEvent.click(await screen.findByRole("button", { name: "Abrir la ficha de Laura Gómez" }));
    const drawer = await screen.findByRole("dialog", { name: /Laura Gómez/ });
    const purchases = await within(drawer).findByRole("region", { name: "Compras" });
    expect(purchases).toHaveTextContent("Lleva comprado$ 49.900 COP");
    expect(purchases).toHaveTextContent("Compras1 + 1 abierta");
    expect(within(purchases).getByLabelText("Compra n.º 2").closest("li")).toHaveTextContent("Abierta · en Pidió precio");
    expect(within(purchases).getByLabelText("Compra n.º 1").closest("li")).toHaveTextContent("anuncio «Canción para mamá»");
  });
});
