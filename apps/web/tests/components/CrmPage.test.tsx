import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { CrmPage } from "../../src/features/crm/pages/CrmPage";
import { reachedOf, ribbonPath } from "../../src/features/crm/pipeline/FunnelRibbon";
import { moveCard } from "../../src/features/crm/pipeline/useBoard";
import { BOARD, PIPELINE, card, stubCrmApi } from "../helpers/crmApi";

// ---------------------------------------------------------------------------
// El CRM: el tablero (estándar: columnas y tarjetas) con la cinta del embudo
// y sus números en palabras, moverse con «Mover a…» (y preguntar por qué al
// perder), la lista por etapa, el embudo de ejemplo y lo que cada rol ve.
// ---------------------------------------------------------------------------

const page = (path = "/crm") => render(<MemoryRouter initialEntries={[path]}><CrmPage /></MemoryRouter>);

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("CrmPage · tablero", () => {
  it("columnas por etapa con su número y lo que suman, y los números del embudo en palabras", async () => {
    stubCrmApi();
    page();
    const nuevo = await screen.findByRole("region", { name: "Nuevo: 3" });
    expect(within(nuevo).getByText("Pedro Ríos")).toBeInTheDocument();
    expect(within(nuevo).getAllByText("Sin valor").length).toBe(2);
    expect(within(screen.getByRole("region", { name: "Pidió precio: 1" })).getAllByText("$ 49.900 COP").length).toBeGreaterThan(0);
    const stats = screen.getByRole("region", { name: "Resumen del embudo" });
    expect(within(stats).getByText("20 compran")).toBeInTheDocument();
    expect(within(stats).getByText("2,4 días")).toBeInTheDocument();
    expect(screen.getByText("40 % avanza")).toBeInTheDocument();
    expect(screen.getByText("50 % compra")).toBeInTheDocument();
  });

  it("«Mover a…» pasa al cliente de etapa; a «Perdido» pregunta por qué", async () => {
    const { calls } = stubCrmApi();
    page();
    await userEvent.click(await screen.findByRole("button", { name: "Mover a Laura Gómez" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Pagó" }));
    await waitFor(() => expect(calls).toContainEqual({ method: "PUT", path: "/crm/pipelines/p1/deals/c1/stage", body: { stageId: "s3" } }));

    await userEvent.click(screen.getByRole("button", { name: "Mover a Pedro Ríos" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Perdido" }));
    const dialog = screen.getByRole("dialog", { name: "¿Por qué no compró?" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Le pareció caro" }));
    await userEvent.click(within(dialog).getByRole("button", { name: "Mover" }));
    await waitFor(() => expect(calls).toContainEqual({ method: "PUT", path: "/crm/pipelines/p1/deals/c2/stage", body: { stageId: "s4", reason: "Le pareció caro" } }));
  });

  it("la vista Lista muestra la etapa elegida y viaja en la dirección", async () => {
    const { calls } = stubCrmApi();
    page();
    await screen.findByRole("region", { name: "Nuevo: 3" });
    await userEvent.click(screen.getByRole("button", { name: "Lista" }));
    expect(await screen.findByRole("columnheader", { name: "Responsable" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: /Pidió precio/ }));
    await waitFor(() => expect(calls.some((call) => call.path.startsWith("/crm/pipelines/p1/stages/s2/cards"))).toBe(true));
    expect(await within(screen.getByRole("table")).findByText("Laura Gómez")).toBeInTheDocument();
  });

  it("filtra por responsable y busca en el servidor", async () => {
    const { calls } = stubCrmApi();
    page();
    await screen.findByRole("region", { name: "Nuevo: 3" });
    await userEvent.click(screen.getByRole("button", { name: "Mis clientes" }));
    await waitFor(() => expect(calls.some((call) => call.path === "/crm/pipelines/p1/board?owner=me")).toBe(true));
    await userEvent.type(screen.getByLabelText("Buscar cliente"), "laura");
    await waitFor(() => expect(calls.some((call) => call.path === "/crm/pipelines/p1/board?owner=me&search=laura")).toBe(true));
  });
});

describe("CrmPage · empezar y permisos", () => {
  it("sin embudos, quien configura crea el de ejemplo con un toque", async () => {
    const { calls } = stubCrmApi({ pipelines: [] });
    page();
    await userEvent.click(await screen.findByRole("button", { name: "Crear mi embudo" }));
    expect(calls).toContainEqual(expect.objectContaining({ method: "POST", path: "/crm/pipelines/starter" }));
    expect(await screen.findByRole("region", { name: "Nuevo: 3" })).toBeInTheDocument();
  });

  it("solo lectura ve el tablero, sin mover, agregar ni configurar", async () => {
    stubCrmApi({ canWrite: false, canManage: false });
    page();
    await screen.findByRole("region", { name: "Nuevo: 3" });
    expect(screen.queryByRole("button", { name: /Mover a/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Configurar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "+ Agregar cliente" })).not.toBeInTheDocument();
  });

  it("configurar guarda las etapas, la de entrada y la de compra", async () => {
    const { calls } = stubCrmApi();
    page();
    await userEvent.click(await screen.findByRole("button", { name: "Configurar" }));
    const dialog = screen.getByRole("dialog", { name: "Configurar el embudo" });
    await userEvent.clear(within(dialog).getByLabelText("Nombre de la etapa 2"));
    await userEvent.type(within(dialog).getByLabelText("Nombre de la etapa 2"), "Interesado");
    await userEvent.click(within(dialog).getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(calls.find((call) => call.method === "PATCH" && call.path === "/crm/pipelines/p1")?.body).toMatchObject({
      name: "Ventas de video",
      stages: [{ id: "s1", name: "Nuevo" }, { id: "s2", name: "Interesado", outcome: "open" }, { id: "s3" }, { id: "s4", outcome: "lost" }],
      entryStage: 0,
      saleStage: 2
    }));
  });
});

describe("piezas del tablero", () => {
  it("la cinta nunca se ensancha: se dibuja con los que llegaron a cada etapa o más allá", () => {
    const counts = new Map([["s1", 3], ["s2", 1], ["s3", 1]]);
    expect(reachedOf(PIPELINE.stages.slice(0, 3), counts)).toEqual([5, 2, 1]);
    expect(ribbonPath([5, 2, 1])).toMatch(/^M0,10 L/);
    expect(ribbonPath([0, 0])).toContain("Z");
  });

  it("mover en pantalla saca la tarjeta de su columna y la pone arriba de la otra", () => {
    const moved = moveCard(BOARD, card({}), "s3");
    expect(moved.columns.find((column) => column.stageId === "s2")).toMatchObject({ count: 0, cards: [] });
    expect(moved.columns.find((column) => column.stageId === "s3")!.cards[0]).toMatchObject({ contactId: "c1", stageId: "s3" });
  });
});
