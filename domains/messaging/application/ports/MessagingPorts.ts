import type { AdOrigin } from "../../../../contracts/AdOrigin";
import type { InboundChannelMessage, InboundOutcome } from "../../../../contracts/InboundMessageContracts";
import type { InboundTriggerFacts } from "../../../../contracts/ConnectionTriggerContracts";
import type { OutboundMessage } from "../../../../contracts/RuntimeContracts";
import type { FlowRunResult } from "../../../../contracts/FlowTimerContracts";

// ---------------------------------------------------------------------------
// Lo que la mensajería entrante necesita del resto de la plataforma. Cada
// puerto es una responsabilidad; la composición decide quién la cumple.
// ---------------------------------------------------------------------------

/** Registro de mensajes recibidos: evita duplicados y deja rastro de lo que pasó. */
export interface InboundMessageLog {
  /** Lo registra si es nuevo. `false` si ese mensaje ya se había recibido. */
  claim(tenantId: string, message: InboundChannelMessage): Promise<boolean>;
  /** Anota el resultado. */
  finish(
    tenantId: string,
    connectionId: string,
    providerMessageId: string,
    outcome: InboundOutcome,
    detail: { readonly flowKey?: string; readonly sent?: number; readonly error?: string; readonly events?: ReadonlyArray<string> }
  ): Promise<void>;
}

/** Procesa de a un mensaje por conversación: dos seguidos no se pisan. */
export interface ConversationLock {
  withLock<T>(key: string, work: () => Promise<T>): Promise<T>;
}

/** El contacto que escribe: lo crea (con su nombre de WhatsApp) si es nuevo. */
export interface InboundContacts {
  /** Con `ad`, guarda en la ficha el anuncio de clic a WhatsApp por el que escribió. */
  identify(tenantId: string, phone: string, displayName: string | null, ad?: AdOrigin | null): Promise<{ readonly contactId: string; readonly isNew: boolean }>;
}

/** ¿El cliente está dentro de un flujo en esta conversación? */
export interface LiveSessions {
  liveFlowOf(tenantId: string, conversationKey: string): Promise<string | null>;
}

/** Qué flujo inicia un mensaje en ese número (sus disparadores). */
export interface TriggerRouter {
  route(tenantId: string, connectionId: string, facts: InboundTriggerFacts): Promise<{ readonly flowKey: string; readonly triggerId: string } | null>;
}

/** Corre el flujo con el mensaje: el contrato público del motor. */
export type { FlowExecutor as FlowRunner } from "../../../../flow-engine/ports/FlowExecutor";

/** Cómo le fue a cada salida (las pausas y presencias no se informan). */
export interface DeliveryResult {
  readonly message: OutboundMessage;
  readonly ok: boolean;
  readonly error?: string;
  /** Id que WhatsApp le dio (con él llegan los avisos de entregado y leído). */
  readonly providerMessageId?: string;
}

export interface DeliveryReport {
  readonly sent: number;
  readonly failures: ReadonlyArray<string>;
  readonly results: ReadonlyArray<DeliveryResult>;
}

/** Envía las respuestas del flujo por el número que recibió el mensaje. `onResult`: cada salida al momento. */
export interface OutboundDelivery {
  deliver(
    tenantId: string,
    connectionId: string,
    phone: string,
    messages: ReadonlyArray<OutboundMessage>,
    onResult?: (result: DeliveryResult) => Promise<void>
  ): Promise<DeliveryReport>;
}

/** El chat de la bandeja: guarda cada mensaje y dice si el bot lo atiende. */
export interface ConversationLog {
  recordInbound(tenantId: string, message: InboundChannelMessage, contactId: string | null): Promise<{ readonly id: string; readonly botEnabled: boolean }>;
  /** El chat de ese cliente en ese número; lo abre si no existe (flujos iniciados desde fuera). */
  openChat(tenantId: string, connectionId: string, phone: string, contactId: string | null): Promise<{ readonly id: string }>;
  /** El chat de ese cliente en ese número, si existe (para los despertadores). */
  findChat(tenantId: string, connectionId: string, phone: string): Promise<{ readonly id: string; readonly botEnabled: boolean; readonly connectionDeleted: boolean } | null>;
  recordOutbound(
    tenantId: string,
    conversationId: string,
    results: ReadonlyArray<DeliveryResult>,
    origin: { readonly author: "bot" | "agent"; readonly flowKey?: string }
  ): Promise<void>;
}

/** Terminar el recorrido en curso de una conversación (al enviar otro flujo a mano). */
export interface SessionControl {
  endLive(tenantId: string, conversationKey: string): Promise<void>;
}

/** A quién pertenece un turno de flujo: la conversación y el flujo. */
export interface FlowTurnTarget {
  readonly tenantId: string;
  readonly connectionId: string;
  readonly phone: string;
  readonly conversationKey: string;
  readonly flowKey: string;
}

/**
 * Despertadores de los flujos (FASE C6): tras cada turno, deja programado el
 * que pidió el motor (Programador, tiempo máximo de una espera, pausa larga)
 * y cancela los que ya no aplican. Lo cumple la cola de tareas.
 */
export interface FlowTimers {
  afterTurn(target: FlowTurnTarget, result: FlowRunResult): Promise<void>;
}
