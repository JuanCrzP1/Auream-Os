import type { AureamNotifier } from "../webhooks/AureamNotifier";
import { connectionEvent, messageEvent, receiptEvent } from "../webhooks/uazapiEvents";
import { instanceId, instanceToken, messageId } from "./ids";
import type { SimulatorStore } from "./SimulatorStore";
import type { MessageKind, SimInstance, SimMessage } from "./types";

// ---------------------------------------------------------------------------
// El comportamiento del WhatsApp simulado, sin HTTP (lo usan la API que imita
// a uazapi y el teléfono de prueba):
//
//   números      crear, pedir QR, «escanear» (conectar), desconectar, borrar
//   del negocio  lo que envía Auream queda en el chat como enviado y, al poco,
//                entregado (como WhatsApp); leído cuando el cliente abre el chat
//   del cliente  lo que escribe en el teléfono de prueba le llega a Auream
//                como un mensaje entrante de uazapi
// ---------------------------------------------------------------------------

/** Lo que tarda en llegar «entregado» después de enviar (como un celular con señal). */
export const DELIVERY_DELAY_MS = 700;

type NewMessage = Partial<Pick<SimMessage, "text" | "mediaUrl" | "mimeType" | "fileName" | "voice" | "viewOnce" | "menu" | "replyTo" | "choiceId">> & { readonly kind: MessageKind };

/** El QR de prueba: una imagen que dice dónde «escanearlo». */
const QR_IMAGE = `data:image/svg+xml;base64,${Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="264" height="264" viewBox="0 0 264 264"><rect width="264" height="264" fill="#fff"/><rect x="16" y="16" width="232" height="232" rx="18" fill="none" stroke="#6c4fe0" stroke-width="6" stroke-dasharray="14 10"/><text x="132" y="118" font-family="sans-serif" font-size="20" font-weight="700" text-anchor="middle" fill="#1b1830">QR de prueba</text><text x="132" y="150" font-family="sans-serif" font-size="13" text-anchor="middle" fill="#6b6785">Escanéalo en el teléfono</text><text x="132" y="168" font-family="sans-serif" font-size="13" text-anchor="middle" fill="#6b6785">de prueba (localhost:3200)</text></svg>`
).toString("base64")}`;

export class Simulator {
  public constructor(
    public readonly store: SimulatorStore,
    private readonly notifier: AureamNotifier,
    private readonly deliveryDelayMs = DELIVERY_DELAY_MS
  ) {}

  public createInstance(name: string, profileName: string | null): SimInstance {
    const instance: SimInstance = {
      id: instanceId(), token: instanceToken(), name, status: "disconnected", phone: null, profileName,
      webhookUrl: null, webhookEvents: [], createdAt: new Date().toISOString()
    };
    this.store.instances.set(instance.id, instance);
    this.store.changed();
    return instance;
  }

  public qrOf(instance: SimInstance): string {
    return instance.status === "connecting" ? QR_IMAGE : "";
  }

  /** Auream pidió el QR: el número queda esperando que lo «escaneen». */
  public async startLinking(instance: SimInstance): Promise<void> {
    if (instance.status === "connected") return;
    instance.status = "connecting";
    this.store.changed();
    await this.notifier.send(instance, connectionEvent(instance));
  }

  /** Se «escaneó» el QR desde el teléfono de prueba con este número. */
  public async scan(instance: SimInstance, phone: string, profileName: string | null): Promise<void> {
    instance.status = "connected";
    instance.phone = phone;
    if (profileName) instance.profileName = profileName;
    this.store.changed();
    await this.notifier.send(instance, connectionEvent(instance));
  }

  public async disconnect(instance: SimInstance): Promise<void> {
    instance.status = "disconnected";
    this.store.changed();
    await this.notifier.send(instance, connectionEvent(instance));
  }

  public remove(instance: SimInstance): void {
    this.store.instances.delete(instance.id);
    this.store.messages = this.store.messages.filter((message) => message.instanceId !== instance.id);
    this.store.changed();
  }

  /** Auream envió algo al cliente: queda en su chat y, al poco, «entregado». */
  public fromBusiness(instance: SimInstance, phone: string, input: NewMessage): SimMessage {
    this.store.contact(phone);
    const message = this.store.addMessage(this.build(instance, phone, true, input));
    this.store.presence.delete(`${instance.id}:${phone}`);
    setTimeout(() => void this.advance(instance, phone, [message.id], "delivered"), this.deliveryDelayMs).unref?.();
    return message;
  }

  /** El cliente de prueba escribió: le llega a Auream como mensaje entrante. */
  public async fromClient(instance: SimInstance, phone: string, input: NewMessage): Promise<SimMessage> {
    const contact = this.store.contact(phone);
    const message = this.store.addMessage(this.build(instance, phone, false, input));
    await this.notifier.send(instance, messageEvent(instance, contact, message));
    return message;
  }

  /** El cliente abrió el chat: todo lo del negocio queda «leído» (los chulos azules en Auream). */
  public async read(instance: SimInstance, phone: string): Promise<number> {
    const unread = this.store.chat(instance.id, phone).filter((message) => message.fromBusiness && message.status !== "read").map((message) => message.id);
    if (unread.length > 0) await this.advance(instance, phone, unread, "read");
    return unread.length;
  }

  /** Reacción a un mensaje (de Auream o del cliente). Vacío la quita. */
  public react(target: SimMessage, emoji: string): void {
    target.reaction = emoji || null;
    this.store.changed();
  }

  private async advance(instance: SimInstance, phone: string, ids: ReadonlyArray<string>, state: "delivered" | "read"): Promise<void> {
    const rank = { sent: 0, delivered: 1, read: 2 } as const;
    const moved = ids.filter((id) => {
      const message = this.store.message(id);
      if (!message || rank[message.status] >= rank[state]) return false;
      message.status = state;
      return true;
    });
    if (moved.length === 0) return;
    this.store.changed();
    await this.notifier.send(instance, receiptEvent(instance, phone, moved, state));
  }

  private build(instance: SimInstance, phone: string, fromBusiness: boolean, input: NewMessage): SimMessage {
    return {
      id: messageId(), instanceId: instance.id, contactPhone: phone, fromBusiness, kind: input.kind, text: input.text ?? "",
      mediaUrl: input.mediaUrl ?? null, mimeType: input.mimeType ?? null, fileName: input.fileName ?? null, voice: input.voice ?? false,
      ...(input.viewOnce ? { viewOnce: true } : {}),
      menu: input.menu ?? null, replyTo: input.replyTo ?? null, choiceId: input.choiceId ?? null, reaction: null,
      status: fromBusiness ? "sent" : "read", at: new Date().toISOString()
    };
  }
}
