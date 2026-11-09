import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConnectionsPage } from "../../src/features/connections/pages/ConnectionsPage";
import { connectionMenu } from "../../src/features/connections/components/connectionActions";
import type { ConnectionSummary } from "@contracts/ConnectionContracts";

// ---------------------------------------------------------------------------
// Las acciones de un número, como en Leona: el menú cambia según el estado;
// desconectar pide confirmación y la conexión queda «Desconectada» (con
// «Reconectar»); reiniciar no pide confirmación y avisa; la foto de perfil se
// muestra y, si el enlace vence, vuelve el ícono.
// ---------------------------------------------------------------------------

const reply = (status: number, body?: unknown) =>
  ({ ok: status < 400, status, json: async () => body, text: async () => JSON.stringify(body ?? {}) }) as unknown as Response;

const CONNECTED: ConnectionSummary = {
  id: "w1",
  name: "Ventas Colombia",
  method: "qr",
  status: "connected",
  phoneNumber: "573013815302",
  profileName: "Dilo Cantando",
  profilePictureUrl: "https://pps.whatsapp.net/v/numero.jpg",
  lastConnectedAt: "2026-11-01T15:00:00.000Z",
  triggerCount: 2,
  createdAt: "2026-11-01T15:00:00.000Z",
  updatedAt: "2026-11-01T15:00:00.000Z"
};

function stubApi() {
  let item = CONNECTED;
  const calls: string[] = [];
  vi.stubGlobal("fetch", vi.fn(async (input: string, init?: RequestInit) => {
    const url = new URL(String(input), "http://api.test");
    const method = init?.method ?? "GET";
    if (method !== "GET") calls.push(`${method} ${url.pathname}`);
    if (url.pathname === "/connections" && method === "GET") return reply(200, { connections: [item] });
    if (url.pathname === "/connections/w1/disconnect") {
      item = { ...item, status: "disconnected" };
      return reply(200, item);
    }
    if (url.pathname === "/connections/w1/restart") return reply(200, item);
    return reply(404, { message: "no" });
  }));
  return { calls };
}

const openMenu = async () => userEvent.click(await screen.findByRole("button", { name: "Más acciones de Ventas Colombia" }));
const menuItems = () => within(screen.getByRole("menu")).getAllByRole("menuitem").map((item) => item.textContent);

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("acciones de un número", () => {
  it("el menú depende del estado: conectado se reinicia o desconecta; desconectado se reconecta", () => {
    expect(connectionMenu("connected").map((item) => item.label)).toEqual(["Ver estado", "Reiniciar conexión", "Desconectar", "Disparadores", "Renombrar", "Eliminar"]);
    expect(connectionMenu("disconnected").map((item) => item.label)).toEqual(["Reconectar", "Disparadores", "Renombrar", "Eliminar"]);
    expect(connectionMenu("pending")[0]!.label).toBe("Vincular número");
  });

  it("desconectar pide confirmación y deja la conexión «Desconectada» con «Reconectar»", async () => {
    const api = stubApi();
    render(<ConnectionsPage />);
    await openMenu();
    expect(menuItems()).toEqual(["Ver estado", "Reiniciar conexión", "Desconectar", "Disparadores", "Renombrar", "Eliminar"]);
    await userEvent.click(screen.getByRole("menuitem", { name: "Desconectar" }));
    const dialog = screen.getByRole("alertdialog", { name: "¿Desconectar «Ventas Colombia»?" });
    expect(dialog).toHaveTextContent(/se conservan/);
    await userEvent.click(within(dialog).getByRole("button", { name: "Desconectar" }));

    expect(await screen.findByRole("button", { name: "Reconectar" })).toBeInTheDocument();
    expect(screen.getByRole("article", { name: "Ventas Colombia, Desconectada" })).toBeInTheDocument();
    expect(api.calls).toEqual(["POST /connections/w1/disconnect"]);
  });

  it("reiniciar no pide confirmación y avisa", async () => {
    const api = stubApi();
    render(<ConnectionsPage />);
    await openMenu();
    await userEvent.click(screen.getByRole("menuitem", { name: "Reiniciar conexión" }));
    expect(await screen.findByRole("status")).toHaveTextContent(/Reiniciando la conexión de «Ventas Colombia»/);
    expect(api.calls).toEqual(["POST /connections/w1/restart"]);
  });

  it("muestra la foto de perfil del número; si el enlace vence, vuelve el ícono", async () => {
    stubApi();
    const { container } = render(<ConnectionsPage />);
    await screen.findByRole("article", { name: "Ventas Colombia, Conectada" });
    const photo = container.querySelector(".wa-avatar img")!;
    expect(photo).toHaveAttribute("src", CONNECTED.profilePictureUrl);
    fireEvent.error(photo);
    expect(container.querySelector(".wa-avatar img")).toBeNull();
    expect(container.querySelector(".wa-avatar svg")).not.toBeNull();
  });
});
