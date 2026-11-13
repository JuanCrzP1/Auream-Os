import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { SYSTEM_CONTACT_FIELDS, type ContactFieldSummary, type ContactFieldsResponse, type DiscoveredField } from "@contracts/ContactFieldContracts";
import { ContactFieldsSettings } from "../../src/features/contact-fields/ContactFieldsSettings";

// ---------------------------------------------------------------------------
// Configuración › Datos › Campos del cliente: la tabla con tipo, qué tan
// lleno y quién lo usa; crear con la clave que sale del nombre; el primer
// día (convertir lo que ya guardan los flujos); borrar escribiendo la clave;
// y quien no organiza solo ve.
// ---------------------------------------------------------------------------

const reply = (status: number, body?: unknown) => ({ ok: status < 400, status, json: async () => body, text: async () => JSON.stringify(body ?? {}) }) as unknown as Response;
const use = (blockName: string, role: "fills" | "reads") => ({ flowKey: "ventas", flowName: "Ventas", blockId: blockName, blockName, role });

const CIUDAD: ContactFieldSummary = {
  id: "f1", key: "ciudad", label: "Ciudad", type: "list", options: ["Medellín", "Bogotá"], createdAt: "", updatedAt: "",
  filled: 64, uses: [use("¿En qué ciudad estás?", "fills"), use("Envíos", "reads")]
};
const CEDULA: ContactFieldSummary = { id: "f2", key: "cedula", label: "Cédula", type: "text", options: [], createdAt: "", updatedAt: "", filled: 0, uses: [] };

const FOUND: DiscoveredField[] = [
  { key: "ciudad", suggestedLabel: "Ciudad", suggestedType: "list", suggestedOptions: ["Medellín", "Bogotá", "Cali"], filled: 72, distinctValues: 5, uses: [use("¿Ciudad?", "fills")], similarTo: [], technical: false },
  { key: "resposta", suggestedLabel: "Resposta", suggestedType: "text", suggestedOptions: [], filled: 3, distinctValues: 3, uses: [], similarTo: ["respuesta"], technical: false },
  { key: "shotstack_id", suggestedLabel: "Shotstack id", suggestedType: "text", suggestedOptions: [], filled: 9, distinctValues: 9, uses: [], similarTo: [], technical: true }
];

function stub(response: Partial<ContactFieldsResponse>) {
  const data: ContactFieldsResponse = { fields: [CIUDAD, CEDULA], system: SYSTEM_CONTACT_FIELDS, totalContacts: 100, undefinedKeys: 0, canManage: true, ...response };
  const fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
    const url = new URL(String(input), "http://api.test");
    const method = init?.method ?? "GET";
    if (url.pathname === "/contact-fields" && method === "GET") return reply(200, data);
    if (url.pathname === "/contact-fields/discover") return reply(200, { suggestions: FOUND });
    if (url.pathname === "/contact-fields" && method === "POST") return reply(201, { ...CEDULA, id: "f3", ...JSON.parse(String(init!.body)) });
    if (url.pathname === "/contact-fields/adopt") return reply(201, { fields: [] });
    if (method === "DELETE") return reply(204);
    return reply(404, {});
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const page = () => render(<MemoryRouter><ContactFieldsSettings /></MemoryRouter>);
const bodyOf = (fetchMock: ReturnType<typeof stub>, path: string) => JSON.parse(String(fetchMock.mock.calls.find(([u, init]) => String(u).endsWith(path) && init?.method === "POST")![1]!.body));

beforeEach(() => vi.restoreAllMocks());

describe("Configuración › Campos del cliente", () => {
  it("cada campo con su tipo, qué tan lleno está y quién lo usa; el detalle dice de dónde sale", async () => {
    stub({});
    page();
    const ciudad = await screen.findByRole("button", { name: "Ciudad · Lista · 2 · lleno en 64 % · 2 bloques de «Ventas»" });
    expect(ciudad).toHaveTextContent("{ciudad}");
    expect(screen.getByRole("button", { name: "Cédula · Texto · lleno en 0 % · Ningún flujo lo usa" })).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Del sistema" })).getByText("{first_name}")).toBeInTheDocument();

    await userEvent.click(ciudad);
    const drawer = screen.getByRole("dialog", { name: "Ciudad" });
    expect(within(within(drawer).getByRole("region", { name: "De dónde sale" })).getByText("¿En qué ciudad estás?")).toBeInTheDocument();
    expect(within(within(drawer).getByRole("region", { name: "Lo usan" })).getByRole("link", { name: "Abrir" })).toHaveAttribute("href", "/builder/ventas");
    expect(drawer).toHaveTextContent("64 de 100 clientes (64 %)");
  });

  it("crear: la clave sale del nombre y una lista pide sus opciones", async () => {
    const fetchMock = stub({});
    page();
    await userEvent.click(await screen.findByRole("button", { name: "Nuevo campo" }));
    const dialog = screen.getByRole("dialog", { name: "Nuevo campo" });
    await userEvent.type(within(dialog).getByRole("textbox", { name: /Nombre/ }), "Producto de interés");
    expect(dialog).toHaveTextContent("{producto_de_interes}");
    await userEvent.click(within(dialog).getByRole("radio", { name: "Lista" }));
    const create = within(dialog).getByRole("button", { name: "Crear campo" });
    expect(create).toBeDisabled();
    await userEvent.type(within(dialog).getByRole("textbox", { name: "Nueva opción" }), "Video{Enter}Canción{Enter}video{Enter}");
    expect(within(dialog).getByRole("status")).toHaveTextContent("«video» ya está en la lista.");
    await userEvent.click(create);
    expect(bodyOf(fetchMock, "/contact-fields")).toEqual({ label: "Producto de interés", type: "list", options: ["Video", "Canción"] });
  });

  it("no deja tomar una clave del sistema", async () => {
    stub({});
    page();
    await userEvent.click(await screen.findByRole("button", { name: "Nuevo campo" }));
    const dialog = screen.getByRole("dialog", { name: "Nuevo campo" });
    await userEvent.type(within(dialog).getByRole("textbox", { name: /Nombre/ }), "Phone");
    expect(dialog).toHaveTextContent("ya lo llena Auream");
    expect(within(dialog).getByRole("button", { name: "Crear campo" })).toBeDisabled();
  });

  it("el primer día propone convertir lo que ya guardan los flujos; lo técnico queda aparte y sin marcar", async () => {
    const fetchMock = stub({ fields: [], undefinedKeys: 2 });
    page();
    const found = await screen.findByRole("region", { name: "Lo que tus flujos ya guardan" });
    expect(found).toHaveTextContent("Tus flujos ya guardan 2 datos de tus clientes");
    expect(found).toHaveTextContent("Parece el mismo dato que «respuesta»");
    expect(within(found).getByRole("checkbox", { name: "Convertir shotstack_id" })).not.toBeChecked();
    await userEvent.click(within(found).getByRole("checkbox", { name: "Convertir resposta" }));
    const label = within(found).getByRole("textbox", { name: "Nombre para ciudad" });
    await userEvent.clear(label);
    await userEvent.type(label, "Ciudad de envío");
    await userEvent.click(within(found).getByRole("button", { name: "Convertir 1 en campo" }));
    expect(bodyOf(fetchMock, "/contact-fields/adopt")).toEqual({ fields: [{ key: "ciudad", label: "Ciudad de envío", type: "list", options: ["Medellín", "Bogotá", "Cali"] }] });
  });

  it("con campos, lo pendiente se revisa desde «por ordenar»", async () => {
    stub({ undefinedKeys: 1 });
    page();
    await userEvent.click(within(await screen.findByRole("region", { name: "Para ordenar" })).getByRole("button", { name: "Revisar" }));
    expect(await screen.findByRole("region", { name: "Lo que tus flujos ya guardan" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Ahora no" }));
    expect(screen.getByRole("button", { name: "Ciudad · Lista · 2 · lleno en 64 % · 2 bloques de «Ventas»" })).toBeInTheDocument();
  });

  it("borrar un campo con datos exige escribir su clave", async () => {
    const fetchMock = stub({});
    page();
    await userEvent.click(await screen.findByRole("button", { name: "Ciudad · Lista · 2 · lleno en 64 % · 2 bloques de «Ventas»" }));
    await userEvent.click(within(screen.getByRole("dialog", { name: "Ciudad" })).getByRole("button", { name: "Borrar campo" }));
    const confirm = screen.getByRole("alertdialog", { name: "¿Borrar «Ciudad»?" });
    expect(confirm).toHaveTextContent("64 clientes tienen este dato");
    expect(confirm).toHaveTextContent("Seguirán funcionando en la conversación");
    const button = within(confirm).getByRole("button", { name: "Borrar campo y datos" });
    expect(button).toBeDisabled();
    await userEvent.type(within(confirm).getByRole("textbox"), "ciudad");
    await userEvent.click(button);
    await vi.waitFor(() => expect(fetchMock.mock.calls.some(([u, init]) => String(u).endsWith("/contact-fields/f1?confirm=ciudad") && init?.method === "DELETE")).toBe(true));
  });

  it("quien no organiza los ve y ve las opciones, pero no los cambia", async () => {
    stub({ canManage: false, undefinedKeys: 3 });
    page();
    expect(await screen.findByText(/Los editan los dueños y administradores/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Nuevo campo" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Para ordenar" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Ciudad · Lista · 2 · lleno en 64 % · 2 bloques de «Ventas»" }));
    const drawer = screen.getByRole("dialog", { name: "Ciudad" });
    expect(within(drawer).getByText("Medellín")).toBeInTheDocument();
    expect(within(drawer).queryByRole("button", { name: "Guardar" })).not.toBeInTheDocument();
    expect(within(drawer).queryByRole("button", { name: "Quitar Medellín" })).not.toBeInTheDocument();
  });
});
