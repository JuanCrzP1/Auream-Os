import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { CrmPage } from "../../src/features/crm/pages/CrmPage";
import { describeEvent } from "../../src/features/crm/deal/DealHistory";
import { dueLabel, timeAgo } from "../../src/features/crm/crmFormat";
import { PIPELINE, stubCrmApi } from "../helpers/crmApi";

// ---------------------------------------------------------------------------
// La ficha del cliente (etapa con el paso siguiente a un toque, responsable,
// seguimientos, historial y «Abrir chat») y la pestaña Seguimientos con su
// insignia de vencidos. El historial dice quién movió y cómo.
// ---------------------------------------------------------------------------

const page = (path = "/crm") => render(<MemoryRouter initialEntries={[path]}><CrmPage /></MemoryRouter>);

beforeEach(() => {
  vi.restoreAllMocks();
});

async function openLaura() {
  await userEvent.click(await screen.findByRole("button", { name: "Abrir la ficha de Laura Gómez" }));
  return screen.findByRole("dialog", { name: /Laura Gómez/ });
}

describe("ficha del cliente", () => {
  it("muestra su etapa, el paso siguiente, su historial, etiquetas y el enlace al chat", async () => {
    stubCrmApi();
    page();
    const drawer = await openLaura();
    expect(await within(drawer).findByText("Etapa · Ventas de video")).toBeInTheDocument();
    expect(within(drawer).getByRole("button", { name: "Mover a Pagó →" })).toBeInTheDocument();
    expect(within(drawer).getByText("Pasó a Pidió precio")).toBeInTheDocument();
    expect(within(drawer).getByText(/por el flujo «Bienvenida»/)).toBeInTheDocument();
    expect(await within(drawer).findByRole("link", { name: "Abrir chat" })).toHaveAttribute("href", "/conversations?search=573001112233");
  });

  it("mover, cambiar responsable y agregar un seguimiento desde la ficha", async () => {
    const { calls } = stubCrmApi();
    page();
    const drawer = await openLaura();
    await userEvent.click(await within(drawer).findByRole("button", { name: "Mover a Pagó →" }));
    await waitFor(() => expect(calls).toContainEqual({ method: "PUT", path: "/crm/pipelines/p1/deals/c1/stage", body: { stageId: "s3" } }));

    await userEvent.selectOptions(within(drawer).getByRole("combobox", { name: "Responsable" }), "u2");
    await waitFor(() => expect(calls).toContainEqual({ method: "PATCH", path: "/crm/pipelines/p1/deals/c1", body: { ownerId: "u2" } }));

    await userEvent.type(within(drawer).getByLabelText("Nuevo seguimiento"), "Confirmar el pago");
    await userEvent.click(within(drawer).getByRole("button", { name: "Agregar" }));
    await waitFor(() => expect(calls.find((call) => call.method === "POST" && call.path === "/crm/follow-ups")?.body).toMatchObject({ contactId: "c1", title: "Confirmar el pago" }));
  });

  it("«No compró» pide el motivo sin cerrar la ficha", async () => {
    const { calls } = stubCrmApi();
    page();
    const drawer = await openLaura();
    await userEvent.click(await within(drawer).findByRole("button", { name: "No compró" }));
    await userEvent.click(within(screen.getByRole("dialog", { name: "¿Por qué no compró?" })).getByRole("button", { name: "Mover" }));
    await waitFor(() => expect(calls).toContainEqual({ method: "PUT", path: "/crm/pipelines/p1/deals/c1/stage", body: { stageId: "s4" } }));
    expect(screen.getByRole("dialog", { name: /Laura Gómez/ })).toBeInTheDocument();
  });
});

describe("seguimientos", () => {
  it("la pestaña lleva la insignia de vencidos y marcar uno como hecho lo guarda", async () => {
    const { calls } = stubCrmApi();
    page("/crm?tab=follow-ups");
    expect(await screen.findByRole("tab", { name: "Seguimientos 1" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Vencidos/ }));
    await userEvent.click(await screen.findByRole("button", { name: "Marcar «Llamar a Laura» como hecho" }));
    await waitFor(() => expect(calls).toContainEqual({ method: "PATCH", path: "/crm/follow-ups/f1", body: { done: true } }));
    await userEvent.click(screen.getByRole("button", { name: "De todo el equipo" }));
    await waitFor(() => expect(calls.some((call) => call.path === "/crm/follow-ups?bucket=overdue&assignee=all")).toBe(true));
  });
});

describe("palabras", () => {
  it("el historial dice quién o qué movió al cliente", () => {
    const base = { id: "e", pipelineId: "p1", fromStageId: null, toStageId: "s3", actorName: null, flowName: null, detail: null, createdAt: "x" };
    expect(describeEvent({ ...base, kind: "stage", source: "sale" }, [PIPELINE])).toMatchObject({ title: "Pasó a Pagó", by: "por una venta aprobada", color: "#0d9488" });
    expect(describeEvent({ ...base, kind: "stage", source: "user", actorName: "Sofía", toStageId: "s4", detail: "Le pareció caro" }, [PIPELINE]).title).toBe("Pasó a Perdido · Le pareció caro");
    expect(describeEvent({ ...base, kind: "owner", source: "auto", detail: "Camilo" }, [PIPELINE])).toMatchObject({ title: "Camilo quedó como responsable", by: "repartido por turnos" });
    expect(describeEvent({ ...base, kind: "stage", source: "user", toStageId: "borrada" }, [PIPELINE]).title).toBe("Pasó a una etapa que ya no está");
  });

  it("tiempos en palabras: hace cuánto y cuándo toca", () => {
    const now = new Date(2026, 10, 10, 15, 0);
    expect(timeAgo(new Date(now.getTime() - 4 * 60_000).toISOString(), now.getTime())).toBe("hace 4 min");
    expect(timeAgo(new Date(now.getTime() - 26 * 3_600_000).toISOString(), now.getTime())).toBe("ayer");
    expect(dueLabel(new Date(2026, 10, 10, 14, 0).toISOString(), now)).toMatchObject({ tone: "overdue" });
    expect(dueLabel(new Date(2026, 10, 10, 18, 0).toISOString(), now)).toMatchObject({ tone: "today" });
    expect(dueLabel(new Date(2026, 10, 11, 9, 0).toISOString(), now).text).toMatch(/^Mañana/);
  });
});
