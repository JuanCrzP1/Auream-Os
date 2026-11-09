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

export type Sleep = (ms: number) => Promise<void>;
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

  /** Envía en orden. Un fallo en una salida no detiene las siguientes; queda en el informe. */
  public async deliver(
    tenantId: string,
    connectionId: string,
    phone: string,
    messages: ReadonlyArray<OutboundMessage>
  ): Promise<{ readonly sent: number; readonly failures: ReadonlyArray<string>; readonly results: ReadonlyArray<{ readonly message: OutboundMessage; readonly ok: boolean; readonly error?: string }> }> {
    if (messages.length === 0) return { sent: 0, failures: [], results: [] };
    const connection = await this.repository.findById(tenantId, connectionId);
    const session = connection ? this.sessionOf(connection) : null;
    const messenger = connection ? this.messengers.for(connection.method) : null;
    if (!connection || !session || !messenger) {
      const error = "El número no tiene una sesión activa para enviar.";
      return { sent: 0, failures: [error], results: messages.filter((m) => m.kind !== "pause").map((message) => ({ message, ok: false, error })) };
    }

    let sent = 0;
    const failures: string[] = [];
    const results: Array<{ message: OutboundMessage; ok: boolean; error?: string }> = [];
    for (const message of messages) {
      if (message.kind === "pause") {
        const wait = message.delayMs ?? 0;
        if (wait > MAX_INLINE_PAUSE_MS) failures.push(`Pausa de ${Math.round(wait / 1000)} s acortada a ${MAX_INLINE_PAUSE_MS / 1000} s.`);
        await this.sleep(Math.min(wait, MAX_INLINE_PAUSE_MS));
        continue;
      }
      try {
        await messenger.send(session, phone, message);
        sent += 1;
        results.push({ message, ok: true });
      } catch (error) {
        const reason = error instanceof MessengerError ? error.message : "No se pudo enviar una respuesta.";
        failures.push(reason);
        results.push({ message, ok: false, error: reason });
      }
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
