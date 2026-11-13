import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import type { ScheduledMessage } from "@contracts/ScheduledMessageContracts";
import { ConversationsPage } from "../../src/features/conversations/pages/ConversationsPage";
import { addDays, instantOf, wallOf } from "../../src/features/conversations/components/scheduled/scheduleModel";
import { NOW, reply, stubConversationsApi } from "../helpers/conversationsApi";

// ---------------------------------------------------------------------------
// Programar mensajes desde el chat: ⏰ junto a enviar (solo con algo
// escrito), «Mañana temprano» en la hora del NEGOCIO, la burbuja punteada
// con su hora y autor, enviar ahora, editar y cancelar (con confirmación);
// lo que no salió, con su motivo; la marca y el filtro de la bandeja.
// ---------------------------------------------------------------------------

const ZONE = "America/Bogota";

/** API falsa con estado de `/conversations/c1/scheduled`. */
function scheduledRoutes(initial: ScheduledMessage[] = []) {
  const items = [...initial];
  const calls: Array<{ method: string; path: string; body: Record<string, unknown> }> = [];
  const list = () => reply(200, { messages: items.filter((item) => ["pending", "failed", "skipped"].includes(item.status)), timeZone: ZONE });
  const routes = (url: URL, method: string, body: Record<string, unknown>) => {
    if (!url.pathname.startsWith("/conversations/c1/scheduled")) return null;
    calls.push({ method, path: url.pathname, body });
    const id = url.pathname.split("/")[4];
    const item = items.find((candidate) => candidate.id === id);
    if (url.pathname === "/conversations/c1/scheduled" && method === "POST") {
      const sendAt = instantOf({ date: String(body["date"]), time: String(body["time"]) }, ZONE).toISOString();
      items.push({ id: `s${items.length + 1}`, conversationId: "c1", parts: body["parts"] as ScheduledMessage["parts"], sendAt, cancelIfReplied: body["cancelIfReplied"] !== false, status: "pending", error: null, authorId: "u-me", authorName: "Camilo", createdAt: NOW });
    }
    if (item && method === "PATCH") Object.assign(item, { parts: body["parts"] ?? item.parts, cancelIfReplied: body["cancelIfReplied"] ?? item.cancelIfReplied });
    if (item && (method === "DELETE" || url.pathname.endsWith("/send"))) Object.assign(item, { status: method === "DELETE" ? "cancelled" : "sent" });
    return list();
  };
  return { routes, calls, items };
}

const pending = (over: Partial<ScheduledMessage> = {}): ScheduledMessage => ({
  id: "s9", conversationId: "c1", parts: [{ kind: "text", text: "¿Pudiste hacer el pago?" }], sendAt: new Date(Date.now() + 86_400_000).toISOString(),
  cancelIfReplied: true, status: "pending", error: null, authorId: "u-ana", authorName: "Ana Ruiz", createdAt: NOW, ...over
});

async function openChat() {
  await userEvent.click(await screen.findByRole("button", { name: /Laura Gómez/ }));
  return screen.findByRole("region", { name: "Chat con Laura Gómez" });
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("Mensajes programados en el chat", () => {
  it("programa lo escrito para «Mañana temprano» en la hora del negocio y queda como burbuja punteada", async () => {
    const scheduled = scheduledRoutes();
    stubConversationsApi({ routes: scheduled.routes });
    render(<MemoryRouter><ConversationsPage /></MemoryRouter>);
    const chat = await openChat();
    expect(within(chat).queryByRole("button", { name: "Programar envío" })).not.toBeInTheDocument();

    await userEvent.type(within(chat).getByLabelText("Escribe un mensaje"), "Te recuerdo el pago 🙏");
    await userEvent.click(await within(chat).findByRole("button", { name: "Programar envío" }));
    const popover = within(chat).getByRole("dialog", { name: "Programar envío" });
    expect(within(popover).getByRole("radio", { name: /Mañana temprano/ })).toHaveAttribute("aria-checked", "true");
    expect(within(popover).getByRole("checkbox", { name: /No enviar si el cliente responde antes/ })).toBeChecked();
    await userEvent.click(within(popover).getByRole("button", { name: "Programar" }));

    const tomorrow = addDays(wallOf(new Date(), ZONE).date, 1);
    await vi.waitFor(() => expect(scheduled.calls.find((call) => call.method === "POST")?.body).toEqual({ parts: [{ kind: "text", text: "Te recuerdo el pago 🙏" }], date: tomorrow, time: "09:00", cancelIfReplied: true }));
    const bubbles = await within(chat).findByLabelText("Mensajes programados");
    expect(bubbles).toHaveTextContent("Te recuerdo el pago 🙏");
    expect(bubbles).toHaveTextContent("🕘 mañana, 9:00 a. m. · Camilo · si no responde");
    expect(within(chat).getByLabelText("Escribe un mensaje")).toHaveValue("");
    expect(within(chat).queryByRole("dialog", { name: "Programar envío" })).not.toBeInTheDocument();
  });

  it("una hora pasada no se programa: lo dice sin llamar al servidor", async () => {
    const scheduled = scheduledRoutes();
    stubConversationsApi({ routes: scheduled.routes });
    render(<MemoryRouter><ConversationsPage /></MemoryRouter>);
    const chat = await openChat();
    await userEvent.type(within(chat).getByLabelText("Escribe un mensaje"), "Hola");
    await userEvent.click(await within(chat).findByRole("button", { name: "Programar envío" }));
    const popover = within(chat).getByRole("dialog", { name: "Programar envío" });
    const date = within(popover).getByLabelText("Fecha");
    await userEvent.clear(date);
    await userEvent.type(date, addDays(wallOf(new Date(), ZONE).date, -1));
    await userEvent.click(within(popover).getByRole("button", { name: "Programar" }));
    expect(within(popover).getByRole("alert")).toHaveTextContent("al menos un minuto más adelante");
    expect(scheduled.calls.some((call) => call.method === "POST")).toBe(false);
  });

  it("pendiente: editar el texto, cancelar con confirmación y enviar ahora", async () => {
    const scheduled = scheduledRoutes([pending(), pending({ id: "s8", parts: [{ kind: "text", text: "Otro" }] })]);
    stubConversationsApi({ routes: scheduled.routes });
    render(<MemoryRouter><ConversationsPage /></MemoryRouter>);
    const chat = await openChat();
    const bubbles = await within(chat).findByLabelText("Mensajes programados");
    const first = within(bubbles).getByText("¿Pudiste hacer el pago?").closest("article")!;
    expect(first).toHaveTextContent("Ana Ruiz");

    await userEvent.click(within(first as HTMLElement).getByRole("button", { name: "Editar" }));
    const dialog = await screen.findByRole("dialog", { name: "Editar mensaje programado" });
    await userEvent.clear(within(dialog).getByLabelText("Mensaje"));
    await userEvent.type(within(dialog).getByLabelText("Mensaje"), "¿Ya pudiste pagar?");
    await userEvent.click(within(dialog).getByRole("button", { name: "Guardar" }));
    expect(await within(bubbles).findByText("¿Ya pudiste pagar?")).toBeInTheDocument();
    const patch = scheduled.calls.find((call) => call.method === "PATCH")!;
    expect(patch.body).toEqual({ parts: [{ kind: "text", text: "¿Ya pudiste pagar?" }], cancelIfReplied: true });

    const second = within(bubbles).getByText("Otro").closest("article") as HTMLElement;
    await userEvent.click(within(second).getByRole("button", { name: "Cancelar" }));
    await userEvent.click(await screen.findByRole("button", { name: "Sí, cancelarlo" }));
    await vi.waitFor(() => expect(within(bubbles).queryByText("Otro")).not.toBeInTheDocument());

    await userEvent.click(within(bubbles).getByRole("button", { name: "Enviar ahora" }));
    await vi.waitFor(() => expect(within(chat).queryByLabelText("Mensajes programados")).not.toBeInTheDocument());
    expect(scheduled.calls.some((call) => call.path === "/conversations/c1/scheduled/s9/send")).toBe(true);
  });

  it("lo que no salió muestra el motivo con «Reintentar» y «Descartar»; el omitido, «Enviar igual»", async () => {
    stubConversationsApi({
      routes: scheduledRoutes([
        pending({ status: "failed", error: "El número no tiene una sesión activa para enviar." }),
        pending({ id: "s8", status: "skipped", error: "El cliente respondió antes.", parts: [{ kind: "text", text: "Seguimiento" }] })
      ]).routes
    });
    render(<MemoryRouter><ConversationsPage /></MemoryRouter>);
    const chat = await openChat();
    const bubbles = await within(chat).findByLabelText("Mensajes programados");
    const failed = within(bubbles).getByText("¿Pudiste hacer el pago?").closest("article") as HTMLElement;
    expect(failed).toHaveTextContent("No salió: El número no tiene una sesión activa para enviar.");
    expect(within(failed).getByRole("button", { name: "Reintentar" })).toBeInTheDocument();
    expect(within(failed).getByRole("button", { name: "Descartar" })).toBeInTheDocument();
    expect(within(failed).queryByRole("button", { name: "Editar" })).not.toBeInTheDocument();
    const skipped = within(bubbles).getByText("Seguimiento").closest("article") as HTMLElement;
    expect(skipped).toHaveTextContent("No salió: El cliente respondió antes.");
    expect(within(skipped).getByRole("button", { name: "Enviar igual" })).toBeInTheDocument();
  });

  it("la bandeja marca los chats con programados (o uno que no salió) y los filtra", async () => {
    const api = stubConversationsApi({ chat: { nextScheduledAt: new Date(Date.now() + 3_600_000).toISOString() } });
    render(<MemoryRouter><ConversationsPage /></MemoryRouter>);
    const row = await screen.findByRole("button", { name: /Laura Gómez, 2 sin leer, tiene un mensaje programado/ });
    expect(within(row).getByText(/Programado/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Con programados" }));
    await vi.waitFor(() => expect(api.last().get("filter")).toBe("scheduled"));
  });
});
