import type { AgentMessagePart } from "../../../contracts/ConversationContracts";
import { SCHEDULE_MAX_DAYS, SCHEDULE_MIN_LEAD_MS, type ScheduledMessageStatus } from "../../../contracts/ScheduledMessageContracts";
import { isRealDate, zonedToInstant } from "../../../flow-engine/values/zonedTime";
import { ValidationError } from "../../../platform/observability/errors/ValidationError";

// ---------------------------------------------------------------------------
// Un mensaje programado de un chat y sus reglas (puras):
//
//   · la hora se elige en la zona del NEGOCIO (no en la del asesor): «mañana
//     a las 9» es a las 9 de Bogotá aunque quien lo programe esté en Madrid
//   · de un minuto a 90 días adelante
//   · pending → sending → sent | failed | skipped; pending | failed | skipped
//     → cancelled. Solo un pendiente se edita; uno fallido u omitido se
//     reintenta o se descarta
// ---------------------------------------------------------------------------

export interface StoredScheduledMessage {
  readonly id: string;
  readonly tenantId: string;
  readonly conversationId: string;
  readonly parts: ReadonlyArray<AgentMessagePart>;
  readonly sendAt: string;
  readonly cancelIfReplied: boolean;
  readonly status: ScheduledMessageStatus;
  readonly error: string | null;
  readonly authorId: string | null;
  readonly authorName: string | null;
  /** Cuándo se programó o se editó por última vez: si el cliente escribe después, «respondió antes». */
  readonly armedAt: string;
  /** Cuándo empezó a enviarse (estado `sending`). */
  readonly claimedAt: string | null;
  readonly createdAt: string;
}

/** Se puede enviar ya (o reintentar). */
export const SENDABLE: ReadonlyArray<ScheduledMessageStatus> = ["pending", "failed", "skipped"];
/** Se puede cancelar (pendiente) o descartar (no salió). */
export const CANCELLABLE: ReadonlyArray<ScheduledMessageStatus> = ["pending", "failed", "skipped"];

/** Un envío que lleva más que esto «saliendo» se cortó a medias. */
export const STALE_SENDING_MS = 120_000;

export const NOT_CONFIRMED = "No se pudo confirmar si salió. Revisa el chat antes de reintentar.";
export const CLIENT_REPLIED = "El cliente respondió antes.";

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DAY_MS = 86_400_000;

/**
 * El instante de `{ date, time }` en la zona del negocio, validado: fecha y
 * hora reales, al menos un minuto adelante y a lo sumo 90 días.
 */
export function resolveSendAt(when: { readonly date?: unknown; readonly time?: unknown }, timezone: string, now: Date): Date {
  const date = typeof when.date === "string" ? DATE.exec(when.date.trim()) : null;
  const time = typeof when.time === "string" ? TIME.exec(when.time.trim()) : null;
  if (!date || !isRealDate(Number(date[1]), Number(date[2]), Number(date[3]))) throw new ValidationError("Elige una fecha válida.");
  if (!time) throw new ValidationError("Elige una hora válida.");
  const at = zonedToInstant({ year: Number(date[1]), month: Number(date[2]), day: Number(date[3]), hour: Number(time[1]), minute: Number(time[2]), second: 0 }, timezone);
  if (at.getTime() - now.getTime() < SCHEDULE_MIN_LEAD_MS) throw new ValidationError("Elige una hora al menos un minuto más adelante.");
  if (at.getTime() - now.getTime() > SCHEDULE_MAX_DAYS * DAY_MS) throw new ValidationError(`Se puede programar hasta ${SCHEDULE_MAX_DAYS} días adelante.`);
  return at;
}

/** «No enviar si el cliente responde antes»: activado salvo que se diga lo contrario. */
export function cancelIfRepliedOf(value: unknown): boolean {
  if (value === undefined) return true;
  if (typeof value !== "boolean") throw new ValidationError("Indica si se cancela cuando el cliente responde antes.");
  return value;
}

/** El cliente escribió después de programarlo (o editarlo). */
export function clientRepliedSince(message: Pick<StoredScheduledMessage, "armedAt">, lastInboundAt: string | null): boolean {
  return lastInboundAt !== null && Date.parse(lastInboundAt) > Date.parse(message.armedAt);
}

/** Lleva demasiado «saliendo»: el envío se cortó a medias. */
export function isStaleSending(message: Pick<StoredScheduledMessage, "status" | "claimedAt">, now: Date): boolean {
  return message.status === "sending" && (message.claimedAt === null || now.getTime() - Date.parse(message.claimedAt) > STALE_SENDING_MS);
}
