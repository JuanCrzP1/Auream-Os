import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConversationsPage } from "../../src/features/conversations/pages/ConversationsPage";
import { stubConversationsApi as stubApi } from "../helpers/conversationsApi";

// ---------------------------------------------------------------------------
// Bandeja de Conversaciones: la lista con no leídos y etiquetas, abrir un chat
// con su hilo (cliente, bot y un envío fallido), responder como asesor (pausa
// el bot), reactivar el bot, ejecutar un flujo, filtrar (etiquetas, fecha,
// estado), etiquetar desde «Info. del contacto» y «Ver más chats».
// API falsa con estado (`tests/helpers/conversationsApi.ts`).
// ---------------------------------------------------------------------------

async function openChat() {
  await userEvent.click(await screen.findByRole("button", { name: /Laura Gómez/ }));
  return screen.findByRole("region", { name: "Chat con Laura Gómez" });
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("ConversationsPage", () => {
  it("lista los chats con sus etiquetas y abre uno con su hilo: cliente, bot con menú y un envío fallido", async () => {
    const api = stubApi();
    render(<ConversationsPage />);
    const row = await screen.findByRole("button", { name: "Laura Gómez, 2 sin leer" });
    expect(within(row).getByLabelText("Etiquetas: VIP")).toBeInTheDocument();
    await userEvent.click(row);

    const chat = await screen.findByRole("region", { name: "Chat con Laura Gómez" });
    expect(await within(chat).findByText("Hola")).toBeInTheDocument();
    // Sin el nombre del flujo encima de la burbuja (chat normal); queda como ayuda al pasar el cursor.
    expect(within(chat).queryByText(/🤖/)).not.toBeInTheDocument();
    expect(within(chat).getByText("¿Qué buscas?").closest(".ios-bubble")).toHaveAttribute("title", "Bot · Ventas");
    expect(within(chat).getByLabelText("Opciones enviadas")).toHaveTextContent("Ver precios");
    expect(within(chat).getByText("No se envió: uazapi no disponible (503)")).toBeInTheDocument();
    expect(within(chat).getByText("En el flujo «Ventas»")).toBeInTheDocument();
    await vi.waitFor(() => expect(api.fetchMock.mock.calls.some(([u]) => String(u).endsWith("/conversations/c1/read"))).toBe(true));
  });

  it("responder como asesor envía, aparece en el hilo y pausa el bot; se puede reactivar", async () => {
    stubApi();
    render(<ConversationsPage />);
    const chat = await openChat();

    await userEvent.type(await within(chat).findByLabelText("Escribe un mensaje"), "Hola, te ayudo yo{Enter}");
    expect(await within(chat).findByText("Hola, te ayudo yo")).toBeInTheDocument();
    const toggle = within(chat).getByRole("switch");
    expect(toggle).toHaveAttribute("aria-checked", "false");
    expect(within(chat).getByText(/Atiendes este chat/)).toBeInTheDocument();

    await userEvent.click(within(chat).getByRole("button", { name: "Activar bot" }));
    await vi.waitFor(() => expect(within(chat).getByRole("switch")).toHaveAttribute("aria-checked", "true"));
  });

  it("«Ejecutar flujo»: solo flujos no archivados, y confirma lo ejecutado", async () => {
    const api = stubApi();
    render(<ConversationsPage />);
    const chat = await openChat();

    await userEvent.click(await within(chat).findByRole("button", { name: "Ejecutar flujo" }));
    const dialog = await screen.findByRole("dialog", { name: "Ejecutar flujo para Laura Gómez" });
    expect(await within(dialog).findByText("Ventas")).toBeInTheDocument();
    expect(within(dialog).queryByText("Viejo")).not.toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: /Ventas/ }));

    expect(await within(chat).findByText("Se ejecutó «Ventas».")).toBeInTheDocument();
    const call = api.fetchMock.mock.calls.find(([u]) => String(u).endsWith("/conversations/c1/flows"));
    expect(JSON.parse(String(call![1]!.body))).toEqual({ automationId: "f1" });
  });

  it("filtra por estado, etiquetas y fecha; los filtros aplicados se ven y se quitan", async () => {
    const api = stubApi();
    render(<ConversationsPage />);
    await screen.findByRole("button", { name: /Laura Gómez/ });

    await userEvent.click(screen.getByRole("tab", { name: "Con asesor" }));
    await vi.waitFor(() => expect(api.last().get("filter")).toBe("bot_paused"));

    await userEvent.click(screen.getByRole("button", { name: /Filtros/ }));
    const panel = screen.getByRole("group", { name: "Filtros de la bandeja" });
    await userEvent.click(await within(panel).findByRole("button", { name: "Pagó" }));
    await userEvent.click(within(panel).getByRole("button", { name: "Hoy" }));
    await vi.waitFor(() => {
      expect(api.last().get("labelIds")).toBe("l-pago");
      expect(api.last().get("from")).toBe(new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()).toISOString());
    });

    const applied = screen.getByRole("list", { name: "Filtros aplicados" });
    expect(within(applied).getByText("Pagó")).toBeInTheDocument();
    expect(within(applied).getByText("Hoy")).toBeInTheDocument();
    await userEvent.click(within(applied).getByRole("button", { name: "Quitar filtro Pagó" }));
    await vi.waitFor(() => expect(api.last().get("labelIds")).toBeNull());

    await userEvent.click(within(panel).getByRole("button", { name: "Elegir fechas" }));
    await userEvent.type(within(panel).getByLabelText("Desde"), "2026-11-10");
    await userEvent.type(within(panel).getByLabelText("Hasta"), "2026-11-01");
    expect(within(panel).getByRole("alert")).toHaveTextContent("«Desde» debe ser antes de «Hasta»");
  });

  it("«Info. del contacto»: etiquetar el chat guarda las etiquetas de su cliente", async () => {
    const api = stubApi();
    render(<ConversationsPage />);
    const chat = await openChat();

    await userEvent.click(within(chat).getByRole("button", { name: "Ver info. de Laura Gómez" }));
    const info = await screen.findByRole("complementary", { name: "Info. de Laura Gómez" });
    expect(within(info).getByText("Ventas")).toBeInTheDocument();
    await userEvent.click(within(info).getByRole("button", { name: "Editar" }));
    await userEvent.click(await within(info).findByRole("checkbox", { name: /Pagó/ }));

    await vi.waitFor(() => expect(within(info).getByRole("checkbox", { name: /Pagó/ })).toHaveAttribute("aria-checked", "true"));
    const call = api.fetchMock.mock.calls.find(([u, init]) => String(u).endsWith("/conversations/c1/labels") && init?.method === "PUT");
    expect(JSON.parse(String(call![1]!.body))).toEqual({ labelIds: ["l-vip", "l-pago"] });

    await userEvent.click(within(info).getByRole("button", { name: "Cerrar info. del contacto" }));
    expect(screen.queryByRole("complementary", { name: "Info. de Laura Gómez" })).not.toBeInTheDocument();
  });

  it("«Ver más chats» trae la página siguiente con el cursor", async () => {
    const api = stubApi({ paged: true });
    render(<ConversationsPage />);
    await userEvent.click(await screen.findByRole("button", { name: "Ver más chats" }));

    expect(await screen.findByRole("button", { name: "Pedro Ruiz" })).toBeInTheDocument();
    expect(api.listCalls.some((params) => params.get("cursor") === "page-2")).toBe(true);
    expect(screen.queryByRole("button", { name: "Ver más chats" })).not.toBeInTheDocument();
  });

  it("chat de un número eliminado: se lee el historial, pero sin barra para escribir, sin bot ni «Ejecutar flujo»", async () => {
    stubApi({ deleted: true });
    render(<ConversationsPage />);
    const row = await screen.findByRole("button", { name: /Laura Gómez/ });
    expect(within(row).getByText("venta · eliminado")).toBeInTheDocument();
    await userEvent.click(row);
    const chat = await screen.findByRole("region", { name: "Chat con Laura Gómez" });

    expect(await within(chat).findByText("Hola")).toBeInTheDocument();
    expect(within(chat).getByText("Número eliminado · venta")).toBeInTheDocument();
    expect(within(chat).getByRole("note")).toHaveTextContent("El número «venta» fue eliminado");
    expect(within(chat).queryByLabelText("Escribe un mensaje")).not.toBeInTheDocument();
    expect(within(chat).queryByRole("button", { name: "Ejecutar flujo" })).not.toBeInTheDocument();
    expect(within(chat).queryByRole("switch")).not.toBeInTheDocument();
  });
});
