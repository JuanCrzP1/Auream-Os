import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
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
    render(<MemoryRouter><ConversationsPage /></MemoryRouter>);
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

  it("responder como asesor envía, aparece en el hilo y toma el chat (bot en pausa); se puede devolver al bot", async () => {
    stubApi();
    render(<MemoryRouter><ConversationsPage /></MemoryRouter>);
    const chat = await openChat();
    expect(within(chat).getByRole("button", { name: "Atención: Con bot. Cambiar" })).toBeInTheDocument();

    await userEvent.type(await within(chat).findByLabelText("Escribe un mensaje"), "Hola, te ayudo yo{Enter}");
    expect(await within(chat).findByText("Hola, te ayudo yo")).toBeInTheDocument();
    expect(await within(chat).findByRole("button", { name: "Atención: Tú. Cambiar" })).toBeInTheDocument();
    expect(within(chat).getByText(/Atiendes este chat/)).toBeInTheDocument();

    await userEvent.click(within(chat).getByRole("button", { name: "Activar bot" }));
    expect(await within(chat).findByRole("button", { name: "Atención: Con bot. Cambiar" })).toBeInTheDocument();
  });

  it("«Registrar venta» desde el chat: con su cliente (sin pedir teléfono), el país por el indicativo y el precio solo; cuenta para su anuncio", async () => {
    const api = stubApi({ canRecordSales: true });
    render(<MemoryRouter><ConversationsPage /></MemoryRouter>);
    const chat = await openChat();
    await userEvent.click(await within(chat).findByRole("button", { name: "Registrar venta" }));
    const dialog = await screen.findByRole("dialog", { name: "Registrar venta" });
    expect(within(dialog).getByLabelText("Cliente del chat")).toHaveTextContent("Laura Gómez");
    expect(within(dialog).queryByLabelText("WhatsApp del cliente")).not.toBeInTheDocument();
    expect(within(dialog).getByLabelText("País del cliente")).toHaveValue("CO");
    await userEvent.selectOptions(within(dialog).getByLabelText("Producto"), "p1");
    expect(within(dialog).getByLabelText("Monto")).toHaveValue("49900");
    await userEvent.click(within(dialog).getByRole("button", { name: "Registrar venta" }));

    expect(await within(chat).findByText(/Venta registrada: Video · \$ 49\.900 COP\. Cuenta para el anuncio por el que llegó\./)).toBeInTheDocument();
    const [, init] = api.fetchMock.mock.calls.find(([u, i]) => String(u).endsWith("/sales") && i?.method === "POST")!;
    const sent = JSON.parse(String(init!.body)) as Record<string, unknown>;
    expect(sent).toMatchObject({ conversationId: "c1", productId: "p1", amount: "49900", currency: "COP", country: "CO", customerName: "Laura Gómez" });
    expect(sent).not.toHaveProperty("customerPhone");
  });

  it("sin permiso para anotar ventas no aparece «Registrar venta»", async () => {
    stubApi();
    render(<MemoryRouter><ConversationsPage /></MemoryRouter>);
    const chat = await openChat();
    await within(chat).findByRole("button", { name: "Ejecutar flujo" });
    expect(within(chat).queryByRole("button", { name: "Registrar venta" })).not.toBeInTheDocument();
  });

  it("anuncio de origen: marca en la lista, filtro «Por anuncio» y la tarjeta en la info con su campaña y enlaces seguros", async () => {
    const api = stubApi({
      chat: { fromAd: true },
      ad: {
        sourceId: "ad-9", title: "Tu canción", body: "Regala una canción con su nombre", thumbnailUrl: "https://meta.example/t.jpg", sourceUrl: "https://fb.me/x", mediaUrl: null,
        receivedAt: new Date(Date.now() - 3 * 86_400_000).toISOString(), connected: true, adName: "Tu canción · Mamás", campaignName: "Video Colombia", adStatus: "ACTIVE"
      }
    });
    render(<MemoryRouter><ConversationsPage /></MemoryRouter>);
    const row = await screen.findByRole("button", { name: /Laura Gómez, 2 sin leer, llegó por un anuncio/ });
    expect(within(row).getByText("Anuncio")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Por anuncio" }));
    await vi.waitFor(() => expect(api.last().get("filter")).toBe("from_ad"));

    await userEvent.click(row);
    const chat = await screen.findByRole("region", { name: "Chat con Laura Gómez" });
    await userEvent.click(within(chat).getByRole("button", { name: "Info. del contacto" }));
    const card = await screen.findByRole("region", { name: "Llegó por un anuncio" });
    expect(await within(card).findByText("Tu canción · Mamás")).toBeInTheDocument();
    expect(card).toHaveTextContent("Campaña: Video Colombia");
    expect(card).toHaveTextContent("Activo");
    expect(card).toHaveTextContent("Llegó hace 3 días");
    expect(card).toHaveTextContent("«Tu canción»");
    expect(within(card).getByRole("link", { name: "Ver anuncio ↗" })).toHaveAttribute("rel", "noopener noreferrer");
    expect(within(card).queryByRole("link", { name: /Ver publicación/ })).not.toBeInTheDocument();
    expect(card).not.toHaveTextContent("no está en tus cuentas conectadas");
  });

  it("anuncio de otra cuenta: lo dice; un chat orgánico no pide el anuncio", async () => {
    stubApi({ chat: { fromAd: true }, ad: { sourceId: "777", title: "Promo", body: null, thumbnailUrl: null, sourceUrl: null, mediaUrl: null, receivedAt: null, connected: false, adName: null, campaignName: null, adStatus: null } });
    const first = render(<MemoryRouter><ConversationsPage /></MemoryRouter>);
    const chat = await openChat();
    await userEvent.click(within(chat).getByRole("button", { name: "Info. del contacto" }));
    const card = await screen.findByRole("region", { name: "Llegó por un anuncio" });
    expect(await within(card).findByText("Promo")).toBeInTheDocument();
    expect(card).toHaveTextContent("no está en tus cuentas conectadas de Meta Ads");
    expect(card).toHaveTextContent("Id: 777.");
    first.unmount();

    const api = stubApi();
    render(<MemoryRouter><ConversationsPage /></MemoryRouter>);
    const organic = await openChat();
    await userEvent.click(within(organic).getByRole("button", { name: "Info. del contacto" }));
    await screen.findByRole("complementary", { name: "Info. de Laura Gómez" });
    expect(screen.queryByRole("region", { name: "Llegó por un anuncio" })).not.toBeInTheDocument();
    expect(api.fetchMock.mock.calls.some(([u]) => String(u).endsWith("/conversations/c1/ad"))).toBe(false);
  });

  it("«Ejecutar flujo»: solo flujos no archivados, y confirma lo ejecutado", async () => {
    const api = stubApi();
    render(<MemoryRouter><ConversationsPage /></MemoryRouter>);
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
    render(<MemoryRouter><ConversationsPage /></MemoryRouter>);
    await screen.findByRole("button", { name: /Laura Gómez/ });

    await userEvent.click(screen.getByRole("tab", { name: /En espera/ }));
    await vi.waitFor(() => expect(api.last().get("status")).toBe("waiting"));
    await userEvent.click(screen.getByRole("tab", { name: "Todos" }));
    await userEvent.click(screen.getByRole("button", { name: "Sin responder" }));
    await vi.waitFor(() => expect(api.last().get("filter")).toBe("unanswered"));

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
    render(<MemoryRouter><ConversationsPage /></MemoryRouter>);
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
    render(<MemoryRouter><ConversationsPage /></MemoryRouter>);
    await userEvent.click(await screen.findByRole("button", { name: "Ver más chats" }));

    expect(await screen.findByRole("button", { name: "Pedro Ruiz" })).toBeInTheDocument();
    expect(api.listCalls.some((params) => params.get("cursor") === "page-2")).toBe(true);
    expect(screen.queryByRole("button", { name: "Ver más chats" })).not.toBeInTheDocument();
  });

  it("chat de un número eliminado: se lee el historial, pero sin barra para escribir, sin bot ni «Ejecutar flujo»", async () => {
    stubApi({ deleted: true });
    render(<MemoryRouter><ConversationsPage /></MemoryRouter>);
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
