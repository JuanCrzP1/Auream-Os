import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ConversationsPage } from "../../src/features/conversations/pages/ConversationsPage";
import { stubConversationsApi as stubApi } from "../helpers/conversationsApi";

// ---------------------------------------------------------------------------
// Chats, fase 2: pestañas por atención con sus conteos, las etiquetas bajo el
// número, tomar / pasar / resolver, cuánto espera el cliente, notas internas
// y «Chat nuevo».
// ---------------------------------------------------------------------------

async function openChat() {
  await userEvent.click(await screen.findByRole("button", { name: /Laura Gómez/ }));
  return screen.findByRole("region", { name: "Chat con Laura Gómez" });
}

const posts = (api: ReturnType<typeof stubApi>, path: string) =>
  api.fetchMock.mock.calls.filter(([url, init]) => String(url).endsWith(path) && init?.method === "POST").map(([, init]) => JSON.parse(String(init!.body ?? "{}")) as Record<string, unknown>);

beforeEach(() => vi.restoreAllMocks());

describe("Atención de los chats", () => {
  it("la bandeja muestra cuántos esperan y cuánto lleva esperando el cliente", async () => {
    stubApi({ chat: { status: "waiting", botEnabled: false, awaitingSince: new Date(Date.now() - 20 * 60_000).toISOString() } });
    render(<MemoryRouter><ConversationsPage /></MemoryRouter>);
    const row = await screen.findByRole("button", { name: /Laura Gómez.*espera hace 20 min/ });
    expect(within(row).getByText("En espera")).toBeInTheDocument();
    expect(within(row).getByText("⏱ 20 min")).toHaveClass("is-urgent");
    expect(screen.getByRole("tab", { name: "En espera, 1" })).toBeInTheDocument();
  });

  it("las etiquetas se ven bajo el número y abren la info del contacto", async () => {
    stubApi();
    render(<MemoryRouter><ConversationsPage /></MemoryRouter>);
    const chat = await openChat();
    await userEvent.click(within(chat).getByRole("button", { name: "Etiquetas: VIP. Ver o cambiar" }));
    expect(await screen.findByRole("complementary", { name: "Info. de Laura Gómez" })).toBeInTheDocument();
  });

  it("tomar el chat, pasarlo a otra persona y resolverlo", async () => {
    const api = stubApi();
    render(<MemoryRouter><ConversationsPage /></MemoryRouter>);
    const chat = await openChat();

    await userEvent.click(within(chat).getByRole("button", { name: /Tomar chat/ }));
    expect(await within(chat).findByRole("button", { name: "Atención: Tú. Cambiar" })).toBeInTheDocument();
    expect(within(chat).getByRole("status")).toHaveTextContent("Tomaste el chat");

    await userEvent.click(within(chat).getByRole("button", { name: "Atención: Tú. Cambiar" }));
    await userEvent.click(within(screen.getByRole("menu", { name: "Atención del chat" })).getByRole("menuitem", { name: /Ana Ruiz/ }));
    expect(await within(chat).findByRole("button", { name: "Atención: Ana Ruiz. Cambiar" })).toBeInTheDocument();
    expect(posts(api, "/conversations/c1/assign")).toEqual([{ assigneeId: "u-ana" }]);

    await userEvent.click(within(chat).getByRole("button", { name: /Resolver/ }));
    expect(await within(chat).findByRole("button", { name: "Atención: Resuelto. Cambiar" })).toBeInTheDocument();
    expect(within(chat).getByRole("status")).toHaveTextContent("El bot vuelve a atender");
  });

  it("notas internas: se anotan con su autor", async () => {
    const api = stubApi();
    render(<MemoryRouter><ConversationsPage /></MemoryRouter>);
    const chat = await openChat();
    await userEvent.click(within(chat).getByRole("button", { name: "Info. del contacto" }));
    const info = await screen.findByRole("complementary", { name: "Info. de Laura Gómez" });
    expect(await within(info).findByText("Aún no hay notas.")).toBeInTheDocument();
    await userEvent.type(within(info).getByLabelText("Nueva nota interna"), "Pagó la mitad, falta el resto el viernes");
    await userEvent.click(within(info).getByRole("button", { name: "Guardar nota" }));
    const list = await within(info).findByRole("list", { name: "Notas" });
    expect(list).toHaveTextContent("Pagó la mitad, falta el resto el viernes");
    expect(list).toHaveTextContent("Camilo");
    expect(posts(api, "/contacts/k1/notes")).toEqual([{ body: "Pagó la mitad, falta el resto el viernes" }]);
  });

  it("chat nuevo: desde un número conectado, con el primer mensaje, y se abre", async () => {
    const api = stubApi({ connections: [{ id: "w1", name: "venta", status: "connected" }] });
    render(<MemoryRouter><ConversationsPage /></MemoryRouter>);
    await screen.findByRole("button", { name: /Laura Gómez/ });
    await userEvent.click(screen.getByRole("button", { name: "Chat nuevo" }));
    const dialog = screen.getByRole("dialog", { name: "Chat nuevo" });
    await userEvent.type(within(dialog).getByPlaceholderText("300 123 4567"), "300 111 2233");
    await userEvent.type(within(dialog).getByLabelText("Mensaje"), "Hola Laura, te escribo de la tienda");
    await userEvent.click(within(dialog).getByRole("button", { name: "Iniciar chat" }));

    expect(await screen.findByRole("region", { name: "Chat con Laura Gómez" })).toBeInTheDocument();
    expect(posts(api, "/conversations")).toEqual([{ connectionId: "w1", phone: "573001112233", message: { text: "Hola Laura, te escribo de la tienda" } }]);
  });
});
