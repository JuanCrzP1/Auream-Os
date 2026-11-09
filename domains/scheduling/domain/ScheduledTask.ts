// ---------------------------------------------------------------------------
// Una tarea programada: «haz esto a tal hora». La cola es genérica: no sabe
// qué hace cada tarea, solo cuándo toca, cuántas veces se intentó y cómo
// terminó. Cada tipo (`kind`) lo resuelve su manejador (`TaskHandler`).
//
//   pending ──reservar──> running ──bien──> done
//      ↑                     │
//      └──reintentar─────────┤──sin más intentos / error definitivo──> failed
//   pending ──cancelar──> cancelled
//
// Una reserva vence (`lockedUntil`): si el proceso que la tomó muere, otro la
// retoma. Por eso un manejador debe ser idempotente.
// ---------------------------------------------------------------------------

export type TaskStatus = "pending" | "running" | "done" | "failed" | "cancelled";

export interface ScheduledTask {
  readonly id: string;
  readonly tenantId: string;
  /** Tipo de tarea; decide su manejador (p. ej. `flow.timer`). */
  readonly kind: string;
  /** Agrupa tareas que se cancelan juntas (p. ej. las de una conversación). */
  readonly groupKey: string;
  /** Idempotencia: programar dos veces la misma clave deja una sola tarea. */
  readonly dedupeKey: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly status: TaskStatus;
  readonly dueAt: string;
  readonly attempts: number;
  readonly maxAttempts: number;
  readonly lockedUntil: string | null;
  readonly lastError: string | null;
  readonly createdAt: string;
  readonly finishedAt: string | null;
}

export interface NewTask {
  readonly tenantId: string;
  readonly kind: string;
  readonly groupKey: string;
  readonly dedupeKey: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly dueAt: Date;
  readonly maxAttempts?: number;
}

export const DEFAULT_MAX_ATTEMPTS = 5;

/**
 * Eslabón de la cadena de rondas (planes sin cron frecuente): una tarea sin
 * trabajo cuya clave única por tramo de tiempo garantiza UNA sola cadena.
 * No cuenta como trabajo pendiente.
 */
export const CHAIN_TASK_KIND = "scheduling.chain";
export const CHAIN_BUCKET_MS = 30_000;

/** Reintentos espaciados: 30 s, 2 min, 8 min, 32 min… hasta 1 h. */
export function retryDelayMs(attempt: number): number {
  return Math.min(30_000 * 4 ** Math.max(0, attempt - 1), 3_600_000);
}

/** Error que no se arregla reintentando (datos inválidos, manejador inexistente). */
export class PermanentTaskError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "PermanentTaskError";
  }
}
