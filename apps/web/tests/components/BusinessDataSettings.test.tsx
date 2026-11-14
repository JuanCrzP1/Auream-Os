import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import type { BusinessDataResponse, BusinessDatumSummary } from "@contracts/BusinessDataContracts";
import { BusinessDataSettings } from "../../src/features/business-data/BusinessDataSettings";
import { previewPieces } from "../../src/features/business-data/businessDataText";
import { applyQuickReply } from "../../src/features/conversations/components/composer/draft";

// ---------------------------------------------------------------------------
// Configuración › Datos del negocio: lo que les dices igual a todos tus
// clientes, escrito una vez. Cada dato dice dónde se usa y «Así lo ve tu
// cliente» se actualiza mientras escribes. Borrar uno que se usa pide su
// clave. Quien no lo puede cambiar lo ve. «Cómo funciona» explica la pantalla.
// Y en el chat, una respuesta rápida sale con el valor puesto.
// ---------------------------------------------------------------------------

const reply = (status: number, body?: unknown) => ({ ok: status < 400, status, json: async () => body, text: async () => JSON.stringify(body ?? {}) }) as unknown as Response;

const PAGO: BusinessDatumSummary = {
  id: "d1", key: "g_link_de_pago", label: "Link de pago", type: "text", value: "https://tutienda.com/pagar", description: "", schedules: [], createdAt: "", updatedAt: "",
  uses: [{ kind: "flow", flowKey: "ventas", flowName: "Ventas", blockId: "pago", blockName: "Pago", blockType: "message" }, { kind: "quickReply", id: "q1", shortcut: "pago" }],
  example: { template: "Hola {first_name}, paga aquí: {g_link_de_pago}", source: "Flujo «Ventas» · Pago" }
};
const PROMO: BusinessDatumSummary = { id: "d2", key: "g_promo_activa", label: "Promo activa", type: "boolean", value: "true", description: "", schedules: [], createdAt: "", updatedAt: "", uses: [], example: null };
const TZ = "America/Bogota";

function stub(data: BusinessDataResponse) {
  const fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
    const url = new URL(String(input), "http://api.test");
    const method = init?.method ?? "GET";
    if (url.pathname === "/business-data" && method === "GET") return reply(200, data);
    if (url.pathname === "/business-data" && method === "POST") return reply(201, { ...PROMO, id: "d3" });
    if (url.pathname.startsWith("/business-data/") && method === "PATCH") return reply(200, PAGO);
    if (url.pathname.startsWith("/business-data/") && method === "DELETE") return reply(204);
    return reply(404, {});
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const page = () => render(<MemoryRouter><BusinessDataSettings /></MemoryRouter>);
const sent = (fetchMock: ReturnType<typeof stub>, method: string) => {
  const call = fetchMock.mock.calls.find(([, init]) => init?.method === method)!;
  return { url: String(call[0]), body: call[1]?.body ? JSON.parse(String(call[1].body)) : null };
};

beforeEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe("Datos del negocio", () => {
  it("cada dato con su clave, su valor de hoy y dónde se usa; y los precios llevan a Productos", async () => {
    stub({ data: [PAGO, PROMO], canManage: true, timeZone: TZ });
    page();
    const table = await screen.findByRole("region", { name: "Tus datos" });
    expect(within(table).getByRole("button", { name: "Link de pago · Texto · 1 bloque · 1 respuesta rápida" })).toHaveTextContent("{g_link_de_pago}https://tutienda.com/pagar");
    expect(within(table).getByRole("button", { name: /Promo activa/ })).toHaveTextContent("SíSí o noNadie lo usa todavía");
    expect(screen.getByRole("link", { name: "Ir a Productos" })).toHaveAttribute("href", "/sales?tab=products");
  });

  it("crear: la clave g_ sale del nombre y se manda el valor como lo escribe la persona", async () => {
    const fetchMock = stub({ data: [], canManage: true, timeZone: TZ });
    page();
    await userEvent.click(await screen.findByRole("button", { name: "Crear el primero" }));
    const dialog = screen.getByRole("dialog", { name: "Nuevo dato del negocio" });
    await userEvent.type(within(dialog).getByLabelText("Nombre"), "Horario de atención");
    expect(dialog).toHaveTextContent("En tus mensajes se escribe {g_horario_de_atencion}");
    await userEvent.type(within(dialog).getByLabelText("Valor"), "Lunes a sábado, 8 a. m. a 6 p. m.");
    await userEvent.click(within(dialog).getByRole("button", { name: "Crear dato" }));
    expect(sent(fetchMock, "POST").body).toEqual({ label: "Horario de atención", type: "text", value: "Lunes a sábado, 8 a. m. a 6 p. m." });
  });

  it("el detalle: «Así lo ve tu cliente» cambia mientras escribes y avisa dónde cambiará", async () => {
    const fetchMock = stub({ data: [PAGO], canManage: true, timeZone: TZ });
    page();
    await userEvent.click(await screen.findByRole("button", { name: /Link de pago/ }));
    const drawer = screen.getByRole("dialog", { name: "Link de pago" });
    const preview = within(drawer).getByRole("figure", { name: "Así lo ve tu cliente" });
    expect(preview).toHaveTextContent("Hola Laura, paga aquí: https://tutienda.com/pagar");
    expect(preview).toHaveTextContent("Flujo «Ventas» · Pago");
    const value = within(drawer).getByLabelText("Valor");
    await userEvent.clear(value);
    await userEvent.type(value, "https://tutienda.com/pago");
    expect(preview).toHaveTextContent("Hola Laura, paga aquí: https://tutienda.com/pago");
    expect(drawer).toHaveTextContent("Al guardar, cambia en 1 bloque · 1 respuesta rápida.");
    expect(within(drawer).getByRole("link", { name: "Abrir Pago" })).toHaveAttribute("href", "/builder/ventas");
    expect(within(drawer).getByRole("link", { name: "Abrir /pago" })).toHaveAttribute("href", "/settings/quick-replies");
    await userEvent.click(within(drawer).getByRole("button", { name: "Guardar cambios" }));
    expect(sent(fetchMock, "PATCH")).toEqual({ url: expect.stringContaining("/business-data/d1"), body: { label: "Link de pago", type: "text", value: "https://tutienda.com/pago", description: "" } });
  });

  it("borrar uno que se usa pide escribir su clave; uno que nadie usa, no", async () => {
    const fetchMock = stub({ data: [PAGO, PROMO], canManage: true, timeZone: TZ });
    page();
    await userEvent.click(await screen.findByRole("button", { name: /Link de pago/ }));
    await userEvent.click(screen.getByRole("button", { name: "Borrar dato" }));
    const dialog = screen.getByRole("alertdialog", { name: "¿Borrar «Link de pago»?" });
    expect(dialog).toHaveTextContent("Lo usan 1 bloque · 1 respuesta rápida");
    const confirm = within(dialog).getByRole("button", { name: "Borrar dato" });
    expect(confirm).toBeDisabled();
    await userEvent.type(within(dialog).getByRole("textbox"), "g_link_de_pago");
    await userEvent.click(confirm);
    expect(sent(fetchMock, "DELETE").url).toContain("/business-data/d1?confirm=g_link_de_pago");
  });

  it("«Cómo funciona»: se cierra con «Entendido», se recuerda y se vuelve a abrir; sin datos, siempre abierto", async () => {
    stub({ data: [PAGO], canManage: true, timeZone: TZ });
    const first = page();
    const how = await screen.findByRole("region", { name: "Escríbelo una vez. Úsalo en todos tus mensajes." });
    expect(how).toHaveTextContent("Tu cliente lo lee");
    expect(within(how).getByRole("link", { name: /Campos del cliente/ })).toHaveAttribute("href", "/settings/contact-fields");
    await userEvent.click(within(how).getByRole("button", { name: "Entendido" }));
    expect(screen.queryByRole("region", { name: /Escríbelo una vez/ })).toBeNull();
    first.unmount();
    const second = page();
    await userEvent.click(await screen.findByRole("button", { name: "¿Cómo funciona?" }));
    expect(screen.getByRole("region", { name: /Escríbelo una vez/ })).toBeInTheDocument();
    second.unmount();

    window.localStorage.setItem("auream.how-it-works.business-data", "closed");
    stub({ data: [], canManage: true, timeZone: TZ });
    page();
    await screen.findByRole("button", { name: "Crear el primero" });
    expect(within(screen.getByRole("region", { name: /Escríbelo una vez/ })).queryByRole("button", { name: "Entendido" })).toBeNull();
  });

  it("quien no los puede cambiar los ve, sin botones para cambiarlos", async () => {
    stub({ data: [PAGO], canManage: false, timeZone: TZ });
    page();
    expect(await screen.findByText("Los cambian los dueños y administradores. Tú los ves y los usas en tus mensajes.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Nuevo dato" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /Link de pago/ }));
    const drawer = screen.getByRole("dialog", { name: "Link de pago" });
    expect(within(drawer).queryByRole("button", { name: "Guardar cambios" })).toBeNull();
    expect(within(drawer).queryByLabelText("Valor")).toBeNull();
  });
});

describe("el valor en los textos", () => {
  it("la vista previa resalta el dato y pone ejemplos en lo demás", () => {
    expect(previewPieces("Hola {first_name}, cupos: {g_cupos}. {ciudad|tu ciudad}", { g_cupos: 12 })).toEqual([
      { text: "Hola " }, { text: "Laura" }, { text: ", cupos: " }, { text: "12", key: "g_cupos" }, { text: ". " }, { text: "tu ciudad" }
    ]);
  });

  it("en el chat, una respuesta rápida sale con {nombre} y los datos del negocio puestos", () => {
    const applied = applyQuickReply({ id: "q", shortcut: "pago", category: null, pieces: [{ kind: "text", text: "Hola {nombre}, paga aquí: {g_link_de_pago}" }], useCount: 0, lastUsedAt: null } as never, "Laura Gómez", { g_link_de_pago: "https://tutienda.com/pagar" });
    expect(applied.text).toBe("Hola Laura, paga aquí: https://tutienda.com/pagar");
  });
});
