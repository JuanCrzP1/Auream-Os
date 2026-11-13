import type { AgentMessagePart } from "./ConversationContracts";

// ---------------------------------------------------------------------------
// Mensajes programados de un chat: un mensaje del asesor (textos y archivos)
// que sale solo a una hora elegida en la zona horaria del negocio.
//
//   GET    /conversations/:id/scheduled               los abiertos del chat
//   POST   /conversations/:id/scheduled               programar
//   PATCH  /conversations/:id/scheduled/:sid          editar (solo pendientes)
//   POST   /conversations/:id/scheduled/:sid/send     enviar ya (o reintentar)
//   DELETE /conversations/:id/scheduled/:sid          cancelar o descartar
// ---------------------------------------------------------------------------

/**
 *   pending    espera su hora
 *   sending    saliendo en este momento
 *   sent       salió (ya está en el hilo como mensaje del asesor)
 *   failed     no salió (`error` dice por qué); se puede reintentar
 *   skipped    no salió porque el cliente respondió antes
 *   cancelled  lo cancelaron o lo descartaron
 */
export type ScheduledMessageStatus = "pending" | "sending" | "sent" | "failed" | "skipped" | "cancelled";

export interface ScheduledMessage {
  readonly id: string;
  readonly conversationId: string;
  readonly parts: ReadonlyArray<AgentMessagePart>;
  /** Cuándo sale (ISO). */
  readonly sendAt: string;
  /** No sale si el cliente escribe antes. */
  readonly cancelIfReplied: boolean;
  readonly status: ScheduledMessageStatus;
  readonly error: string | null;
  readonly authorId: string | null;
  readonly authorName: string | null;
  readonly createdAt: string;
}

/** Los programados abiertos del chat (pendientes, enviándose, fallidos y omitidos), del más próximo al más lejano. */
export interface ScheduledMessagesResponse {
  readonly messages: ReadonlyArray<ScheduledMessage>;
  /** Zona horaria del negocio (IANA): la de las horas que se eligen y se muestran. */
  readonly timeZone: string;
}

/** Fecha y hora en la zona del negocio: `date` = AAAA-MM-DD, `time` = HH:MM. */
export interface ScheduleWhen {
  readonly date: string;
  readonly time: string;
}

export interface ScheduleMessageRequest extends ScheduleWhen {
  readonly parts: ReadonlyArray<AgentMessagePart>;
  readonly cancelIfReplied?: boolean;
}

/** Editar uno pendiente: cualquiera de sus datos (las piezas, enteras; fecha y hora, juntas). */
export interface UpdateScheduledMessageRequest extends Partial<ScheduleWhen> {
  readonly parts?: ReadonlyArray<AgentMessagePart>;
  readonly cancelIfReplied?: boolean;
}

/** Pendientes a la vez en un chat. */
export const MAX_SCHEDULED_PER_CHAT = 20;
/** Con cuánta anticipación mínima (para que no sea un «enviar» disfrazado). */
export const SCHEDULE_MIN_LEAD_MS = 60_000;
/** Hasta cuántos días adelante. */
export const SCHEDULE_MAX_DAYS = 90;
