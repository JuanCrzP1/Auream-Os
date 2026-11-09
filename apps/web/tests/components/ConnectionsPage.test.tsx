import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConnectionsPage } from "../../src/features/connections/pages/ConnectionsPage";
import type { ConnectionSummary } from "@contracts/ConnectionContracts";

// ---------------------------------------------------------------------------
// Conexiones: invitar a conectar (QR o API oficial), crear en dos pasos y
// pasar a vincular, ver cada estado, renombrar, eliminar y los errores.
// API falsa con estado; sin proveedor, vincular responde «unavailable».
// ---------------------------------------------------------------------------

const reply = (status: number, body?: unknown) =>
  ({ ok: status < 400, status, json: async () => body, text: async () => JSON.stringify(body ?? {}) }) as unknown as Response;

const base = { profileName: null, lastConnectedAt: null, createdAt: "2026-11-08T15:00:00.000Z", updatedAt: "2026-11-08T15:00:00.000Z" };
const CONNECTED: ConnectionSummary = { ...base, id: "w1", name: "Ventas Colombia", method: "qr", status: "connected", phoneNumber: "573013815302", profileName: "Auream", lastConnectedAt: "2026-11-01T15:00:00.000Z" };
const DOWN: ConnectionSummary = { ...base, id: "w2", name: "Venezuela", method: "qr", status: "disconnected", phoneNumber: "584121234567" };
const OFFICIAL: ConnectionSummary = { ...base, id: "w3", name: "Línea oficial", method: "cloud_api", status: "pending", phoneNumber: null };

function stubApi(seed: ConnectionSummary[] = [], options: { listStatus?: number; qr?: boolean } = {}) {
  let items = [...seed];
  const fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
    const url = new URL(String(input), "http://api.test");
    const method = init?.method ?? "GET";
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, string>) : {};
    if (url.pathname === "/connections" && method === "GET") {
      return options.listStatus ? reply(options.listStatus, { message: "x" }) : reply(200, { connections: items });
    }
    if (url.pathname === "/connections" && method === "POST") {
      if (items.some((c) => c.name.toLowerCase() === body["name"]!.toLowerCase())) return reply(409, { message: `Ya tienes una conexión llamada «${body["name"]}».` });
      const created: ConnectionSummary = { ...base, id: `w${items.length + 10}`, name: body["name"]!, method: body["method"] as "qr", status: "pending", phoneNumber: null };
      items.push(created);
      return reply(201, created);
    }
    const status = /^\/connections\/([^/]+)\/status$/.exec(url.pathname);
    if (status) {
      items = items.map((c) => (c.id === status[1] ? { ...c, status: "connected", phoneNumber: "573013815302", profileName: "Dilo Cantando" } : c));
      return reply(200, { state: "connected", connection: items.find((c) => c.id === status[1]) });
    }
    const link = /^\/connections\/([^/]+)\/link$/.exec(url.pathname);
    if (link && options.qr) {
      items = items.map((c) => (c.id === link[1] ? { ...c, status: "connecting" } : c));
      return reply(200, { state: "qr", qrImage: "data:image/png;base64,iVBORw0KGgo", connection: items.find((c) => c.id === link[1]) });
    }
    if (link) {
      const connection = items.find((c) => c.id === link[1])!;
      return reply(200, { state: "unavailable", reason: "provider_not_configured", message: "La vinculación por código QR se activa al conectar el proveedor de WhatsApp.", connection });
    }
    const one = /^\/connections\/([^/]+)$/.exec(url.pathname);
    if (one && method === "PATCH") {
      items = items.map((c) => (c.id === one[1] ? { ...c, name: body["name"]! } : c));
      return reply(200, items.find((c) => c.id === one[1]));
    }
    if (one && method === "DELETE") {
      items = items.filter((c) => c.id !== one[1]);
      return reply(204);
    }
    return reply(404, { message: "no" });
  });
  vi.stubGlobal("fetch", fetchMock);
  return { fetchMock, items: () => items };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("ConnectionsPage", () => {
  it("sin números invita a conectar por QR o con la API oficial", async () => {
    stubApi();
    render(<ConnectionsPage />);
    expect(await screen.findByRole("heading", { name: "Conecta tu primer número de WhatsApp" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Conectar por código QR/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Conectar con la API oficial/ })).toBeInTheDocument();
  });

  it("crea en dos pasos y pasa directo a vincular, que dice con claridad que aún no está disponible", async () => {
    const api = stubApi([CONNECTED]);
    render(<ConnectionsPage />);
    await userEvent.click(await screen.findByRole("button", { name: "Nueva conexión" }));

    const wizard = screen.getByRole("dialog", { name: "¿Cómo quieres conectar el número?" });
    await userEvent.click(within(wizard).getByRole("radio", { name: /API oficial de Meta/ }));
    await userEvent.click(within(wizard).getByRole("button", { name: "Continuar" }));
    await userEvent.type(screen.getByLabelText("Nombre de la conexión"), "Línea oficial");
    await userEvent.click(screen.getByRole("button", { name: "Crear conexión" }));

    const link = await screen.findByRole("dialog", { name: "Línea oficial" });
    expect(await within(link).findByText("Tu conexión ya está creada")).toBeInTheDocument();
    expect(within(link).queryByRole("img", { name: /Código QR/ })).not.toBeInTheDocument();
    expect(api.items().at(-1)).toMatchObject({ name: "Línea oficial", method: "cloud_api", status: "pending" });

    await userEvent.click(within(link).getByRole("button", { name: "Entendido" }));
    expect(await screen.findByRole("article", { name: "Línea oficial, Sin vincular" })).toBeInTheDocument();
  });

  it("un nombre repetido se explica sin cerrar el asistente", async () => {
    stubApi([CONNECTED]);
    render(<ConnectionsPage />);
    await userEvent.click(await screen.findByRole("button", { name: "Nueva conexión" }));
    await userEvent.click(screen.getByRole("button", { name: "Continuar" }));
    await userEvent.type(screen.getByLabelText("Nombre de la conexión"), "ventas colombia");
    await userEvent.click(screen.getByRole("button", { name: "Crear conexión" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Ya tienes una conexión llamada");
    expect(screen.getByLabelText("Nombre de la conexión")).toBeInTheDocument();
  });

  it("muestra cada estado con su número, su resumen y la acción que toca", async () => {
    stubApi([CONNECTED, DOWN, OFFICIAL]);
    render(<ConnectionsPage />);

    const connected = await screen.findByRole("article", { name: "Ventas Colombia, Conectada" });
    expect(within(connected).getByText("+57 301 381 5302")).toBeInTheDocument();
    expect(within(connected).queryByRole("button", { name: /Vincular|Reconectar/ })).not.toBeInTheDocument();

    const down = screen.getByRole("article", { name: "Venezuela, Desconectada" });
    expect(within(down).getByRole("button", { name: "Reconectar" })).toBeInTheDocument();
    expect(within(screen.getByRole("article", { name: "Línea oficial, Sin vincular" })).getByText("Sin número vinculado")).toBeInTheDocument();

    const overview = screen.getByRole("list", { name: "Resumen de conexiones" });
    expect(within(overview).getAllByRole("listitem").map((item) => item.textContent)).toEqual(["1Conectadas", "1Por vincular", "1Desconectadas"]);
  });

  it("renombra y elimina desde el menú de la tarjeta", async () => {
    const api = stubApi([CONNECTED, DOWN]);
    render(<ConnectionsPage />);

    await userEvent.click(await screen.findByRole("button", { name: "Más acciones de Venezuela" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Renombrar" }));
    const input = screen.getByLabelText("Nombre");
    await userEvent.clear(input);
    await userEvent.type(input, "Venezuela VIP");
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));
    expect(await screen.findByRole("article", { name: "Venezuela VIP, Desconectada" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Más acciones de Venezuela VIP" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Eliminar" }));
    await userEvent.click(screen.getByRole("button", { name: "Eliminar conexión" }));
    await vi.waitFor(() => expect(api.items().map((c) => c.id)).toEqual(["w1"]));
    expect(screen.queryByRole("article", { name: /Venezuela/ })).not.toBeInTheDocument();
  });

  it("si no puede cargar lo dice con opción de reintentar; sin permiso, lo explica", async () => {
    stubApi([], { listStatus: 500 });
    const { unmount } = render(<ConnectionsPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent("No pudimos cargar tus conexiones");
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeInTheDocument();
    unmount();

    stubApi([], { listStatus: 403 });
    render(<ConnectionsPage />);
    expect(await screen.findByText("Sin acceso a las conexiones")).toBeInTheDocument();
  });

  it("con proveedor: muestra el QR y, al escanearlo, pasa sola a «Número conectado»", async () => {
    stubApi([OFFICIAL, { ...DOWN, id: "w9", name: "Ventas QR", status: "pending", phoneNumber: null }], { qr: true });
    render(<ConnectionsPage />);
    const card = await screen.findByRole("article", { name: "Ventas QR, Sin vincular" });
    await userEvent.click(within(card).getByRole("button", { name: "Vincular número" }));

    const dialog = await screen.findByRole("dialog", { name: "Ventas QR" });
    expect(await within(dialog).findByRole("img", { name: "Código QR para vincular el número" })).toBeInTheDocument();
    expect(within(dialog).getByText(/Esperando que escanees el código/)).toBeInTheDocument();

    expect(await within(dialog).findByText("¡Número conectado!", undefined, { timeout: 5000 })).toBeInTheDocument();
    expect(within(dialog).getByText("+57 301 381 5302")).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "Listo" }));
    expect(await screen.findByRole("article", { name: "Ventas QR, Conectada" })).toBeInTheDocument();
  }, 10_000);
});
