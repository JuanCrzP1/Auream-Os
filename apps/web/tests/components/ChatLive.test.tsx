import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConversationsPage } from "../../src/features/conversations/pages/ConversationsPage";
import { msg, stubConversationsApi } from "../helpers/conversationsApi";

// ---------------------------------------------------------------------------
// El chat en vivo: los chulos de WhatsApp (uno gris enviado, dos grises
// entregado, dos azules leído) y lo que sale o cambia mientras el chat está
// abierto aparece solo, pidiendo al servidor únicamente lo cambiado.
// ---------------------------------------------------------------------------

async function openChat() {
  await userEvent.click(await screen.findByRole("button", { name: /Laura Gómez/ }));
  return screen.findByRole("region", { name: "Chat con Laura Gómez" });
}

const bubbleOf = (chat: HTMLElement, text: string) => within(chat).getByText(text).closest(".ios-bubble") as HTMLElement;

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("chat en vivo", () => {
  it("cada mensaje que sale lleva sus chulos según lo que avisó WhatsApp; los del cliente no", async () => {
    stubConversationsApi({
      messages: [
        msg({ text: "Hola" }),
        msg({ direction: "outbound", author: "bot", status: "sent", text: "Uno" }),
        msg({ direction: "outbound", author: "bot", status: "delivered", text: "Dos" }),
        msg({ direction: "outbound", author: "bot", status: "read", text: "Tres" })
      ]
    });
    render(<ConversationsPage />);
    const chat = await openChat();

    expect(await within(chat).findByText("Tres")).toBeInTheDocument();
    expect(within(bubbleOf(chat, "Hola")).queryByRole("img")).not.toBeInTheDocument();
    expect(within(bubbleOf(chat, "Uno")).getByRole("img", { name: "Enviado" })).toHaveClass("ios-ticks--sent");
    expect(within(bubbleOf(chat, "Dos")).getByRole("img", { name: "Entregado" })).toHaveClass("ios-ticks--delivered");
    expect(within(bubbleOf(chat, "Tres")).getByRole("img", { name: "Leído" })).toHaveClass("ios-ticks--read");
  });

  it("lo que sale y los avisos de leído aparecen solos, sin volver a abrir el chat, pidiendo solo lo cambiado", async () => {
    const menu = msg({ direction: "outbound", author: "bot", status: "sent", text: "¿Qué buscas?" });
    const api = stubConversationsApi({ messages: [msg({ text: "Hola" }), menu] });
    render(<ConversationsPage />);
    const chat = await openChat();
    expect(await within(chat).findByText("¿Qué buscas?")).toBeInTheDocument();

    // Mientras el chat está abierto: el cliente leyó el menú y el flujo envía otro mensaje.
    api.upsert({ ...menu, status: "read" });
    api.upsert(msg({ direction: "outbound", author: "bot", status: "sent", text: "Te envío el catálogo" }));

    expect(await within(chat).findByText("Te envío el catálogo", {}, { timeout: 5_000 })).toBeInTheDocument();
    expect(within(bubbleOf(chat, "¿Qué buscas?")).getByRole("img", { name: "Leído" })).toBeInTheDocument();
    // La primera consulta trae el chat; las siguientes, solo lo cambiado desde su marca.
    expect(api.liveCalls[0]!.get("since")).toBeNull();
    expect(api.liveCalls.slice(1).every((params) => params.get("since") !== null)).toBe(true);
    // Nada se repite en el hilo.
    expect(within(chat).getAllByText("¿Qué buscas?")).toHaveLength(1);
  });
});
