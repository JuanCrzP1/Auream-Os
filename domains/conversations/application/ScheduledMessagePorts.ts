import type { AgentMessagePart } from "../../../contracts/ConversationContracts";
import type { ScheduledMessageStatus } from "../../../contracts/ScheduledMessageContracts";
import type { StoredScheduledMessage } from "../domain/ScheduledMessage";

// Lo que los mensajes programados necesitan de fuera; la composición decide quién lo cumple.

export interface NewScheduledMessage {
  readonly id: string;
  readonly tenantId: string;
  readonly conversationId: string;
  readonly parts: ReadonlyArray<AgentMessagePart>;
  readonly sendAt: Date;
  readonly cancelIfReplied: boolean;
  readonly authorId: string;
}

export interface ScheduledMessageChanges {
  readonly parts: ReadonlyArray<AgentMessagePart>;
  readonly sendAt: Date;
  readonly cancelIfReplied: boolean;
  readonly armedAt: Date;
}

export type ScheduledOutcome = { readonly status: "sent" | "failed" | "skipped"; readonly error: string | null };

/** Todo filtra por cuenta. */
export interface ScheduledMessageRepository {
  /** Los abiertos del chat (pendientes, saliendo, fallidos y omitidos), del más próximo al más lejano. */
  open(tenantId: string, conversationId: string): Promise<StoredScheduledMessage[]>;
  find(tenantId: string, id: string): Promise<StoredScheduledMessage | null>;
  countPending(tenantId: string, conversationId: string): Promise<number>;
  insert(message: NewScheduledMessage): Promise<void>;
  /** Cambia uno PENDIENTE; `false` si ya no lo está (salió o lo cancelaron). */
  update(tenantId: string, id: string, changes: ScheduledMessageChanges): Promise<boolean>;
  /** Lo toma para enviarlo (pasa a `sending`) si está en uno de esos estados. Atómico: dos a la vez, solo uno lo toma. */
  claim(tenantId: string, id: string, from: ReadonlyArray<ScheduledMessageStatus>, at: Date): Promise<StoredScheduledMessage | null>;
  /** Lo devuelve a como estaba (no se llegó a enviar nada). */
  release(tenantId: string, id: string, to: ScheduledMessageStatus): Promise<void>;
  finish(tenantId: string, id: string, outcome: ScheduledOutcome, at: Date): Promise<void>;
  /** Cancela o descarta uno de esos estados; `false` si no estaba en ninguno. */
  cancel(tenantId: string, id: string, from: ReadonlyArray<ScheduledMessageStatus>, at: Date): Promise<boolean>;
  /** El último mensaje que escribió el cliente en el chat (ISO), o `null`. */
  lastInboundAt(tenantId: string, conversationId: string): Promise<string | null>;
}

/** La cola de tareas: que despierte a su hora para enviarlo. */
export interface ScheduledMessageAlarm {
  arm(tenantId: string, conversationId: string, scheduledId: string, sendAt: Date): Promise<void>;
}

/** Empresa: la zona horaria del negocio (IANA). */
export interface BusinessTimeZone {
  of(tenantId: string): Promise<string>;
}
