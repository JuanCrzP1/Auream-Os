import type { OutboundMessage } from "../../../contracts/RuntimeContracts";
import type { ProviderSession } from "../../../domains/connections/application/ports/WhatsAppLinker";
import { MessengerError, type WhatsAppMessenger } from "../../../domains/connections/application/ports/WhatsAppMessenger";
import { UazapiError, type UazapiClient } from "./UazapiClient";

// ---------------------------------------------------------------------------
// Envío por uazapi de las salidas de un flujo:
//   texto        → /send/text (citando el mensaje si el flujo lo pide)
//   archivo      → /send/media (image · video · audio · document)
//   botones/lista→ /send/menu (button «texto|id» · list «texto|id|descripción»)
//   reacción     → /message/react
// ---------------------------------------------------------------------------

const MEDIA_TYPE = { image: "image", video: "video", audio: "audio", file: "document" } as const;

export class UazapiMessenger implements WhatsAppMessenger {
  public constructor(private readonly client: UazapiClient) {}

  public async send(session: ProviderSession, phone: string, message: OutboundMessage): Promise<void> {
    try {
      await this.dispatch(session.secret, phone, message);
    } catch (error) {
      if (error instanceof UazapiError) throw new MessengerError(error.message);
      throw error;
    }
  }

  public async inboundMedia(session: ProviderSession, providerMessageId: string): Promise<{ readonly url: string; readonly mimeType: string | null }> {
    try {
      return await this.client.downloadMedia(session.secret, providerMessageId);
    } catch (error) {
      if (error instanceof UazapiError) throw new MessengerError(error.message);
      throw error;
    }
  }

  private async dispatch(token: string, phone: string, message: OutboundMessage): Promise<void> {
    if (message.kind === "reaction") {
      if (message.replyToMessageId) await this.client.react(token, message.replyToMessageId, message.content);
      return;
    }
    if (message.kind === "media" && message.media) {
      await this.client.sendMedia(token, phone, {
        type: MEDIA_TYPE[message.media.type],
        file: message.media.url,
        ...(message.content ? { text: message.content } : {}),
        ...(message.media.type === "file" && message.media.fileName ? { docName: message.media.fileName } : {})
      });
      return;
    }
    if (message.interactive && message.interactive.options.length > 0) {
      const menu = message.interactive;
      const body = [menu.header, menu.body].filter(Boolean).join("\n\n");
      await this.client.sendMenu(token, phone, {
        type: menu.type === "list" ? "list" : "button",
        text: body || message.content,
        choices:
          menu.type === "list"
            ? menu.options.map((option) => [option.title, option.id, option.description ?? ""].join("|").replace(/\|$/, ""))
            : menu.options.map((option) => `${option.title}|${option.id}`),
        ...(menu.footer ? { footerText: menu.footer } : {}),
        ...(menu.type === "list" ? { listButton: menu.buttonLabel || "Ver opciones" } : {})
      });
      return;
    }
    if (message.content.trim()) await this.client.sendText(token, phone, message.content, message.replyToMessageId);
  }
}
