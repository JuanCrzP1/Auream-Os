import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { SYSTEM_CONTACT_FIELDS, type ContactFieldSummary, type ContactFieldsResponse } from "@contracts/ContactFieldContracts";
import type { FieldSuggestions } from "@contracts/ContactFieldToolsContracts";
import { ContactFieldsSettings } from "../../src/features/contact-fields/ContactFieldsSettings";

// ---------------------------------------------------------------------------
// Configuración › Campos y datos › Campos del cliente, las herramientas: «por ordenar» sugiere
// ordenar valores y unir campos; cada una muestra qué cambia antes de
// confirmar; lo hecho se puede deshacer; y el detalle dice lo que vende cada
// valor.
// ---------------------------------------------------------------------------

const reply = (status: number, body?: unknown) => ({ ok: status < 400, status, json: async () => body, text: async () => JSON.stringify(body ?? {}) }) as unknown as Response;
const CIUDAD: ContactFieldSummary = { id: "f1", key: "ciudad", label: "Ciudad", type: "list", options: ["Medellín", "Bogotá"], createdAt: "", updatedAt: "", filled: 90, uses: [] };
const RESPUESTA: ContactFieldSummary = { id: "f2", key: "respuesta", label: "Respuesta", type: "text", options: [], createdAt: "", updatedAt: "", filled: 40, uses: [] };
const OPERATION = { id: "op1", kind: "tidy" as const, title: "Ordenaste «Ciudad»", contacts: 43, at: new Date().toISOString(), undoUntil: new Date(Date.now() + 6 * 86_400_000).toISOString() };

const VALUES = {
  fieldId: "f1", key: "ciudad", label: "Ciudad", type: "list", options: ["Medellín", "Bogotá"], filled: 90, distinct: 5, truncated: false,
  groups: [
    { values: [{ value: "Medellín", count: 40 }, { value: "medellin", count: 6 }], count: 46, proposal: { kind: "option", to: "Medellín" } },
    { values: [{ value: "Cartagena", count: 30 }], count: 30, proposal: { kind: "new", to: "Cartagena" } },
    { values: [{ value: "hola", count: 2 }], count: 2, proposal: { kind: "keep" } }
  ]
};
const PREVIEW = {
  keys: [{ key: "respuesta", label: "Respuesta", filled: 40, blocks: 1 }, { key: "resposta", label: null, filled: 12, blocks: 2 }],
  blocks: [{ key: "resposta", flowKey: "v", flowName: "Ventas", blockId: "q", blockName: "Pregunta", blockType: "question", role: "fills" }, { key: "resposta", flowKey: "v", flowName: "Ventas", blockId: "q", blockName: "Pregunta", blockType: "question", role: "reads" }],
  conflicts: 3
};

function stub(suggestions: Partial<FieldSuggestions> = {}, sales: unknown = { days: 30, currencies: [] }) {
  const data: ContactFieldsResponse = { fields: [CIUDAD, RESPUESTA], system: SYSTEM_CONTACT_FIELDS, totalContacts: 100, undefinedKeys: 0, canManage: true, suggestions: { toTidy: [], toMerge: [], operations: [], ...suggestions } };
  const fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
    const url = new URL(String(input), "http://api.test");
    const method = init?.method ?? "GET";
    if (url.pathname === "/contact-fields" && method === "GET") return reply(200, data);
    if (url.pathname === "/contact-fields/f1/values") return reply(200, VALUES);
    if (url.pathname === "/contact-fields/f1/tidy") return reply(200, { operation: OPERATION, flowsSkipped: [] });
    if (url.pathname === "/contact-fields/merge/preview") return reply(200, PREVIEW);
    if (url.pathname === "/contact-fields/merge") return reply(200, { operation: { ...OPERATION, kind: "merge" }, flowsSkipped: ["Bienvenida"] });
    if (url.pathname === "/contact-fields/operations/op1/undo") return reply(200, { contacts: 41, blocksSkipped: 1 });
    if (url.pathname.endsWith("/sales")) return reply(200, sales);
    return reply(404, {});
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const page = () => render(<MemoryRouter><ContactFieldsSettings /></MemoryRouter>);
const sent = (fetchMock: ReturnType<typeof stub>, path: string) => JSON.parse(String(fetchMock.mock.calls.find(([url, init]) => String(url).endsWith(path) && init?.method === "POST")![1]!.body));

beforeEach(() => vi.restoreAllMocks());

describe("Campos del cliente › herramientas", () => {
  it("ordenar valores: muestra los grupos con lo propuesto, deja cambiarlo y manda solo lo confirmado", async () => {
    const fetchMock = stub({ toTidy: [{ fieldId: "f1", label: "Ciudad", kind: "stray", count: 3, examples: ["medellin", "Cartagena"] }] });
    page();
    const pending = await screen.findByRole("region", { name: "Para ordenar" });
    expect(pending).toHaveTextContent("«Ciudad» tiene 3 valores fuera de su lista");
    await userEvent.click(within(pending).getByRole("button", { name: "Ordenar valores" }));

    const dialog = await screen.findByRole("dialog", { name: "Ordenar «Ciudad»" });
    expect(await within(dialog).findByLabelText("«Medellín» queda como")).toHaveValue("Medellín");
    expect(within(dialog).getByLabelText("«Cartagena» queda como")).toHaveValue("Cartagena");
    expect(within(dialog).getByLabelText("«hola» queda como")).toHaveValue("__keep");
    expect(dialog).toHaveTextContent("6 clientes quedan con su dato ordenado");
    expect(dialog).toHaveTextContent("queda como lista con 3 opciones (1 nueva)");

    await userEvent.selectOptions(within(dialog).getByLabelText("«hola» queda como"), "Dejar sin dato");
    expect(dialog).toHaveTextContent("8 clientes quedan con su dato ordenado (2 sin dato)");
    await userEvent.click(within(dialog).getByRole("button", { name: "Ordenar 8 clientes" }));

    expect(sent(fetchMock, "/contact-fields/f1/tidy")).toEqual({ assignments: [{ values: ["Medellín", "medellin"], to: "Medellín" }, { values: ["Cartagena"], to: "Cartagena" }, { values: ["hola"], to: null }] });
  });

  it("unir campos: se elige con cuál quedarse, se ve qué bloques cambian y avisa del flujo que no se pudo tocar", async () => {
    const fetchMock = stub({ toMerge: [{ keys: ["respuesta", "resposta"] }] });
    page();
    await userEvent.click(within(await screen.findByRole("region", { name: "Para ordenar" })).getByRole("button", { name: "Revisar y unir" }));
    const dialog = await screen.findByRole("dialog", { name: "Unir 2 campos en uno" });
    expect(await within(dialog).findByText("Estos bloques pasan a usar {respuesta}")).toBeInTheDocument();
    expect(dialog).toHaveTextContent("40 clientes · 1 bloque");
    expect(dialog).toHaveTextContent("3 clientes están en ese caso");
    await userEvent.click(within(dialog).getByRole("button", { name: "Unir y actualizar 1 bloque" }));

    expect(sent(fetchMock, "/contact-fields/merge")).toEqual({ keep: "respuesta", merge: ["resposta"] });
    expect(await screen.findByRole("alert")).toHaveTextContent("El flujo «Bienvenida» no se pudo actualizar");
  });

  it("lo hecho se puede deshacer, y dice cuántos volvieron", async () => {
    const fetchMock = stub({ operations: [OPERATION] });
    page();
    const recent = await screen.findByRole("region", { name: "Cambios recientes" });
    expect(recent).toHaveTextContent("Ordenaste «Ciudad»");
    expect(recent).toHaveTextContent("43 clientes · se puede deshacer 6 días más");
    await userEvent.click(within(recent).getByRole("button", { name: "Deshacer" }));
    expect(await within(recent).findByRole("status")).toHaveTextContent("Listo: 41 clientes volvieron a como estaba; 1 bloque cambió después y no se tocaron.");
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith("/contact-fields/operations/op1/undo"))).toBe(true);
  });

  it("el detalle del campo dice lo que vende cada valor y deja ordenarlo o unirlo", async () => {
    stub({}, { days: 30, currencies: [{ currency: "COP", total: 250000, values: [{ value: "Medellín", amount: 150000, sales: 2, clients: 1 }, { value: null, amount: 100000, sales: 1, clients: 1 }] }] });
    page();
    await userEvent.click(await screen.findByRole("button", { name: /^Ciudad ·/ }));
    const drawer = screen.getByRole("dialog", { name: "Ciudad" });
    const sales = await within(drawer).findByRole("region", { name: "Lo que vende cada valor de Ciudad" });
    expect(sales).toHaveTextContent("Medellín");
    expect(sales).toHaveTextContent("60 %");
    expect(sales).toHaveTextContent("Sin dato");
    expect(within(drawer).getByRole("button", { name: "Ordenar valores" })).toBeInTheDocument();
    await userEvent.selectOptions(within(drawer).getByRole("combobox", { name: "Unir con otro campo" }), "{respuesta}");
    expect(await screen.findByRole("dialog", { name: "Unir 2 campos en uno" })).toBeInTheDocument();
  });
});
