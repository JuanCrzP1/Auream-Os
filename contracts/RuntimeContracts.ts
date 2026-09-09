/**
 * Contratos del runtime de ejecución.
 *
 * Define los tipos que describen CÓMO se ejecuta un flow en tiempo de ejecución.
 * Completamente separado del modelo de grafo (FlowSnapshot.ts) que describe
 * QUÉ estructura tiene un flow.
 *
 * Regla: si el tipo describe la estructura del grafo → FlowSnapshot.ts
 *         si el tipo describe la ejecución o mensajería → aquí.
 */

/**
 * Estados de sesión y de ejecución del Flow Engine.
 *
 * No existe un estado de handoff: derivar a un asesor humano es responsabilidad
 * del AI Sales Engine, no de este motor. Ver docs/architecture/ai-sales-engine.md.
 */
export type SessionStatus =
  | "active"
  | "waiting_input"
  | "paused"
  | "delayed"
  | "completed"
  | "failed";

export type ExecutionStatus =
  | "success"
  | "completed"
  | "waiting_input"
  | "delayed"
  | "failed";

export interface TenantContext {
  readonly tenantId: string;
  readonly tenantKey: string;
  readonly limits: {
    readonly maxActiveSessions: number;
    readonly maxWebhookRetries: number;
  };
}

export interface InboundEnvelope {
  readonly tenantId: string;
  readonly flowKey: string;
  readonly channel: string;
  readonly conversationKey: string;
  readonly userKey: string;
  readonly messageId: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly receivedAt: string;
}

/**
 * Qué clase de salida es.
 *
 * Ausente equivale a `"text"`: todos los emisores anteriores a esta distinción
 * mandan texto y ninguno tuvo que cambiar. Una reacción NO es un mensaje con
 * otro contenido —no se entrega, no ocupa sitio en la conversación y se adjunta
 * a un mensaje ajeno—, así que se distingue en el contrato en lugar de dejar
 * que cada canal lo adivine por el tamaño del texto.
 */
export type OutboundKind = "text" | "reaction";

export interface OutboundMessage {
  readonly channel: string;
  readonly conversationKey: string;
  /** Texto del mensaje, o el emoji cuando `kind` es `"reaction"`. */
  readonly content: string;
  /**
   * Mensaje del cliente al que esta salida se refiere.
   *
   * Con `kind: "text"` significa citarlo al responder; con `kind: "reaction"`
   * es el mensaje sobre el que se pone el emoji. Sale de
   * `InboundEnvelope.messageId`, que ya viajaba en el envelope: no hay ninguna
   * API de canal nueva detrás de este campo.
   *
   * Opcional: entregarlo como cita o como reacción es responsabilidad del
   * adaptador de canal (Fase D). Hoy el dato se produce correctamente y ningún
   * emisor anterior se ve afectado.
   */
  readonly replyToMessageId?: string;
  /** Ausente = `"text"`. Ver `OutboundKind`. */
  readonly kind?: OutboundKind;
}

export interface NodeExecutionResult {
  readonly executionStatus: ExecutionStatus;
  readonly outputMessages: ReadonlyArray<OutboundMessage>;
  readonly contextPatch: Readonly<Record<string, unknown>>;
  readonly nodeResult: Readonly<Record<string, unknown>>;
  readonly domainEvents: ReadonlyArray<string>;
}

export interface RuntimeInput {
  readonly envelope: InboundEnvelope;
  readonly sessionContext: Readonly<Record<string, unknown>>;
  readonly isWaitingInput: boolean;
}

// ---------------------------------------------------------------------------
// La entidad Conversation NO vive aquí.
//
// Una conversación es el inbox operacional de la plataforma (lista de chats,
// historial, estado visible por el operador) y pertenece al futuro dominio
// `domains/conversations`, NO a los contratos del runtime de ejecución.
//
// El Flow Engine identifica el canal mediante `InboundEnvelope.conversationKey`
// y no necesita conocer la entidad completa.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Session
//
// Representa el estado de ejecución de un flow para una conversación.
// Todos los campos son readonly: la sesión es inmutable.
// Las transiciones de estado se realizan creando nuevas sesiones (ver SessionService).
//
// Campos incluidos explícitamente para permitir migración directa a persistencia SQL
// sin JOINs: channel, conversationKey, userKey, createdAt, updatedAt.
// revision actúa como optimistic lock (incrementa en cada transición).
// ---------------------------------------------------------------------------

export interface Session {
  readonly id: string;
  readonly tenantId: string;
  readonly flowId: string;
  readonly flowVersionId: string;
  readonly channel: string;
  readonly conversationKey: string;
  readonly userKey: string;
  readonly currentNodeId: string;
  readonly status: SessionStatus;
  readonly revision: number;
  readonly context: Readonly<Record<string, unknown>>;
  readonly createdAt: string;
  readonly updatedAt: string;
}
