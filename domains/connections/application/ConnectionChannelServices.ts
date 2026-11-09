import { timingSafeEqual } from "node:crypto";
import type { OutboundMessage } from "../../../contracts/RuntimeContracts";
import type { SecretCipher } from "../../../platform/security/secrets/SecretCipher";
import { connectionSecretContext, type WhatsAppConnection } from "../domain/WhatsAppConnection";
import type { ConnectionRepository } from "./ConnectionRepository";
import type { ProviderSession } from "./ports/WhatsAppLinker";
import { MessengerError, type WhatsAppMessengers } from "./ports/WhatsAppMessenger";

// ---------------------------------------------------------------------------
// El canal de un número: reconocer los avisos de su proveedor y enviar por él.
//
//   authenticate   ¿este aviso viene de verdad de la sesión de esa conexión?
//   deliver        envía las salidas de un flujo, en orden, con sus pausas
//                  («escribiendo…» / «grabando audio…» mientras duran) y avisa
//                  cada resultado al momento (`onResult`: la bandeja en vivo)
//   inboundMedia   enlace de un archivo que mandó el cliente
//
// La credencial de la sesión solo se descifra aquí, en memoria.
// ---------------------------------------------------------------------------

/**
 * Pausa más larga que se espera en línea. El motor ya reparte las pausas para
 * que un turno no pase de 20 s (las demás las retoma la cola de tareas, C6):
 * esto es solo un tope de seguridad.
 */
export const MAX_INLINE_PAUSE_MS = 20_000;

/**
 * «Escribiendo…» más largo que se muestra (lo que WhatsApp sostiene, 5 min).
 * En esperas más largas no se muestra: parecería alguien escribiendo sin fin.
 */
export const MAX_PRESENCE_MS = 5 * 60_000;

export type Sleep = (ms: number) => Promise<void>;

/** Cómo le fue a una salida (las pausas y presencias no se informan). */
export interface ChannelDeliveryResult {
  readonly message: OutboundMessage;
  readonly ok: boolean;
  readonly error?: string;
  /** Id que WhatsApp le dio (para los avisos de entregado y leído). */
  readonly providerMessageId?: string;
}

export interface ChannelDeliveryReport {
  readonly sent: number;
  readonly failures: ReadonlyArray<string>;
  readonly results: ReadonlyArray<ChannelDeliveryResult>;
}

/** Salidas que se informan (las pausas y presencias no son mensajes). */
const isMessage = (message: OutboundMessage) => message.kind !== "pause" && message.kind !== "presence";
const realSleep: Sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function sameSecret(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export class ConnectionChannelServices {
  public constructor(
    private readonly repository: ConnectionRepository,
    private readonly messengers: WhatsAppMessengers,
    private readonly cipher: SecretCipher,
    private readonly sleep: Sleep = realSleep
  ) {}

  /** La conexión si el secreto es el de su sesión; si no, `null` (sin decir por qué). */
  public async authenticate(connectionId: string, secret: string): Promise<WhatsAppConnection | null> {
    const connection = await this.repository.findForProvider(connectionId);
    const session = connection ? this.sessionOf(connection) : null;
    return session && secret && sameSecret(session.secret, secret) ? connection : null;
  }

  public async inboundMedia(connection: WhatsAppConnection, providerMessageId: string): Promise<{ readonly url: string; readonly mimeType: string | null } | null> {
    const session = this.sessionOf(connection);
    const messenger = this.messengers.for(connection.method);
    if (!session || !messenger) return null;
    return messenger.inboundMedia(session, providerMessageId).catch(() => null);
  }

  /** Foto de perfil de un contacto por el número que lo atiende; `null` si no hay o el proveedor falla. */
  public async profilePicture(connection: WhatsAppConnection, phone: string): Promise<string | null> {
    const session = this.sessionOf(connection);
    const messenger = this.messengers.for(connection.method);
    if (!session || !messenger || connection.status !== "connected") return null;
    return messenger.profilePicture(session, phone);
  }

  /**
   * Envía en orden. Un fallo en una salida no detiene las siguientes; queda en
   * el informe. `onResult` se llama apenas sale (o falla) cada mensaje: así la
   * bandeja lo muestra en vivo, no al final del turno.
   */
  public async deliver(
    tenantId: string,
    connectionId: string,
    phone: string,
    messages: ReadonlyArray<OutboundMessage>,
    onResult: (result: ChannelDeliveryResult) => Promise<void> = async () => undefined
  ): Promise<ChannelDeliveryReport> {
    if (messages.length === 0) return { sent: 0, failures: [], results: [] };
    const connection = await this.repository.findById(tenantId, connectionId);
    const session = connection ? this.sessionOf(connection) : null;
    const messenger = connection ? this.messengers.for(connection.method) : null;
    if (!connection || !session || !messenger) {
      const error = "El número no tiene una sesión activa para enviar.";
      const results = messages.filter(isMessage).map((message) => ({ message, ok: false, error }));
      for (const result of results) await onResult(result);
      return { sent: 0, failures: [error], results };
    }

    let sent = 0;
    const failures: string[] = [];
    const results: ChannelDeliveryResult[] = [];
    // La presencia es un detalle: si falla, el mensaje igual sale.
    const showPresence = (message: OutboundMessage, ms: number) =>
      message.presence && ms > 0 && ms <= MAX_PRESENCE_MS ? messenger.presence(session, phone, message.presence, ms).catch(() => undefined) : Promise.resolve();

    for (const message of messages) {
      if (message.kind === "presence") {
        await showPresence(message, message.delayMs ?? 0);
        continue;
      }
      if (message.kind === "pause") {
        const requested = message.delayMs ?? 0;
        const wait = Math.min(requested, MAX_INLINE_PAUSE_MS);
        if (requested > MAX_INLINE_PAUSE_MS) failures.push(`Pausa de ${Math.round(requested / 1000)} s acortada a ${MAX_INLINE_PAUSE_MS / 1000} s.`);
        // A la vez: avisar la presencia no alarga la pausa.
        await Promise.all([showPresence(message, wait), this.sleep(wait)]);
        continue;
      }
      let result: ChannelDeliveryResult;
      try {
        // Un aviso al equipo (Notificación) va a su número, por esta misma conexión.
        const to = message.recipient?.phone ?? phone;
        const providerMessageId = (await messenger.send(session, to, message))?.providerMessageId ?? null;
        sent += 1;
        result = { message, ok: true, ...(providerMessageId ? { providerMessageId } : {}) };
      } catch (error) {
        const reason = error instanceof MessengerError ? error.message : "No se pudo enviar una respuesta.";
        failures.push(reason);
        result = { message, ok: false, error: reason };
      }
      results.push(result);
      await onResult(result);
    }
    return { sent, failures, results };
  }

  private sessionOf(connection: WhatsAppConnection): ProviderSession | null {
    if (!connection.providerRef || !connection.providerSecret) return null;
    try {
      return { ref: connection.providerRef, secret: this.cipher.decrypt(connection.providerSecret, connectionSecretContext(connection.tenantId, connection.id)) };
    } catch {
      return null;
    }
  }
}
