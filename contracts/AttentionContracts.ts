import type { Trend } from "./DashboardContracts";

// ---------------------------------------------------------------------------
// Dashboard › Atención: cuántos escriben, cuántos atiende el equipo o el bot,
// en cuánto responden, cuándo escriben y cómo le va a cada asesor.
// ---------------------------------------------------------------------------

export interface AgentPerformance {
  readonly userId: string;
  readonly name: string;
  /** Chats en los que escribió en el periodo. */
  readonly attended: number;
  readonly messages: number;
  /** Mediana de minutos hasta su primera respuesta en cada chat. */
  readonly responseMinutes: number | null;
  /** Ventas de sus clientes (responsable en el CRM o anotadas por él). */
  readonly sales: number;
  readonly revenue: number;
}

export interface ConnectionAttention {
  readonly id: string;
  readonly name: string;
  readonly connected: boolean;
  readonly leads: number;
  readonly attended: number;
  readonly unanswered: number;
}

export interface AttentionDashboardResponse {
  readonly currency: string;
  /** Chats nuevos del periodo. */
  readonly leads: Trend;
  /** Chats con al menos una respuesta de un asesor. */
  readonly attendedByAgents: Trend;
  /** Chats que solo atendió el bot. */
  readonly botOnly: number;
  /** Chats cuyo último mensaje es del cliente y nadie respondió (ahora). */
  readonly unanswered: number;
  readonly oldestWaitingAt: string | null;
  /** Mediana de minutos hasta la primera respuesta de un asesor. */
  readonly firstResponseMinutes: number | null;
  readonly previousFirstResponseMinutes: number | null;
  /** [día 0=lunes][bloque de 2 h] → chats nuevos. */
  readonly heatmap: ReadonlyArray<ReadonlyArray<number>>;
  readonly peak: { readonly weekday: number; readonly hour: number; readonly chats: number } | null;
  readonly agents: ReadonlyArray<AgentPerformance>;
  readonly connections: ReadonlyArray<ConnectionAttention>;
}
