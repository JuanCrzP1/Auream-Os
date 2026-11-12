import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ConversationsPage } from "../../src/features/conversations/pages/ConversationsPage";
import { stubConversationsApi as stubApi } from "../helpers/conversationsApi";

// ---------------------------------------------------------------------------
// Herramientas del chat (fase 1): respuestas rápidas con «/» (un texto va al
// cuadro con el nombre del cliente; varias piezas quedan en espera), citar y
// reaccionar desde el menú del mensaje, y eliminar el chat (solo quien puede).
// ---------------------------------------------------------------------------

async function openChat() {
  render(<MemoryRouter><ConversationsPage /></MemoryRouter>);
  await userEvent.click(await screen.findByRole("button", { name: /Laura Gómez/ }));
  return screen.findByRole("region", { name: "Chat con Laura Gómez" });
}

const sent = (api: ReturnType<typeof stubApi>) =>
  api.fetchMock.mock.calls
    .filter(([url, init]) => String(url).endsWith("/conversations/c1/messages") && init?.method === "POST")
    .map(([, init]) => JSON.parse(String(init!.body)) as Record<string, unknown>);

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("Herramientas del chat", () => {
  it("«/salu» + Enter pone la respuesta rápida en el cuadro con el nombre del cliente; Enter la envía", async () => {
    const api = stubApi();
    const chat = await openChat();
    const box = await within(chat).findByLabelText("Escribe un mensaje");

    await userEvent.type(box, "/salu");
    expect(await screen.findByRole("dialog", { name: "Respuestas rápidas" })).toHaveTextContent("/saludo");
    await userEvent.keyboard("{Enter}");
    expect(box).toHaveValue("Hola Laura, ¿en qué te ayudo?");

    await userEvent.keyboard("{Enter}");
    await vi.waitFor(() => expect(sent(api)).toHaveLength(1));
    expect(sent(api)[0]).toEqual({ parts: [{ kind: "text", text: "Hola Laura, ¿en qué te ayudo?" }] });
    expect(await within(chat).findByText("Hola Laura, ¿en qué te ayudo?")).toBeInTheDocument();
  });

  it("una respuesta rápida con texto y documento queda en espera y sale en orden", async () => {
    const api = stubApi({ canManage: true });
    const chat = await openChat();

    await userEvent.click(within(chat).getByRole("button", { name: "Respuestas rápidas" }));
    const picker = await screen.findByRole("dialog", { name: "Respuestas rápidas" });
    // En el chat solo se buscan y se envían; se organizan en Configuración.
    expect(within(picker).queryByRole("button", { name: /Nueva|Editar/ })).not.toBeInTheDocument();
    expect(within(picker).getByRole("link", { name: "Administrar →" })).toHaveAttribute("href", "/settings/quick-replies");
    await userEvent.type(within(picker).getByLabelText("Buscar respuesta rápida"), "precios");
    await userEvent.click(within(picker).getByRole("button", { name: /^\/precios/ }));

    const pending = within(chat).getByRole("list", { name: "Se enviará también" });
    expect(pending).toHaveTextContent("Te paso los precios 👇");
    expect(pending).toHaveTextContent("precios.pdf");
    await userEvent.click(within(chat).getByRole("button", { name: "Enviar" }));

    await vi.waitFor(() => expect(sent(api)).toHaveLength(1));
    expect(sent(api)[0]).toEqual({
      parts: [
        { kind: "text", text: "Te paso los precios 👇" },
        { kind: "media", media: { type: "file", url: "https://blob.test/precios.pdf", fileName: "precios.pdf" } }
      ]
    });
  });

  it("responder citando un mensaje y reaccionarle desde su menú", async () => {
    const api = stubApi();
    const chat = await openChat();
    const hola = (await within(chat).findByText("Hola")).closest(".ios-bubble") as HTMLElement;

    await userEvent.click(within(hola).getByRole("button", { name: "Opciones del mensaje" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Reaccionar 👍" }));
    expect(await within(chat).findByLabelText("Reaccionaste 👍")).toBeInTheDocument();

    await userEvent.click(within(hola).getByRole("button", { name: "Opciones del mensaje" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: /Responder/ }));
    expect(within(chat).getByRole("button", { name: "No citar" })).toBeInTheDocument();
    await userEvent.type(within(chat).getByLabelText("Escribe un mensaje"), "Claro que sí{Enter}");

    await vi.waitFor(() => expect(sent(api)).toHaveLength(1));
    expect(sent(api)[0]).toMatchObject({ parts: [{ kind: "text", text: "Claro que sí" }], replyToId: api.messages[0]!.id });
    const answer = (await within(chat).findByText("Claro que sí")).closest(".ios-bubble") as HTMLElement;
    expect(within(answer).getByText("Cliente")).toBeInTheDocument();
  });

  it("eliminar el chat (dueños y administradores): confirma, lo borra y vuelve a la lista", async () => {
    const api = stubApi({ canManage: true });
    const chat = await openChat();
    await userEvent.click(within(chat).getByRole("button", { name: "Info. del contacto" }));
    await userEvent.click(await screen.findByRole("button", { name: "Eliminar chat" }));
    const confirm = await screen.findByRole("alertdialog", { name: "¿Eliminar el chat con Laura Gómez?" });
    await userEvent.click(within(confirm).getByRole("button", { name: "Eliminar chat" }));

    await vi.waitFor(() => expect(screen.queryByRole("region", { name: "Chat con Laura Gómez" })).not.toBeInTheDocument());
    expect(api.fetchMock.mock.calls.some(([url, init]) => String(url).endsWith("/conversations/c1") && init?.method === "DELETE")).toBe(true);
  });

  it("sin permiso no aparece «Eliminar chat»", async () => {
    stubApi({ canManage: false });
    const chat = await openChat();
    await userEvent.click(within(chat).getByRole("button", { name: "Info. del contacto" }));
    expect(await screen.findByText("Info. del contacto")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Eliminar chat" })).not.toBeInTheDocument();
  });
});
