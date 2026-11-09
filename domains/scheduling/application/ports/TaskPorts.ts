import type { ScheduledTask } from "../../domain/ScheduledTask";

// Lo que la cola necesita de fuera. La composición decide quién lo cumple.

/**
 * Ejecuta las tareas de un tipo. Debe ser IDEMPOTENTE (una reserva caducada
 * se reintenta) y lanzar para pedir otro intento (`PermanentTaskError` si no
 * tiene arreglo).
 */
export interface TaskHandler {
  readonly kind: string;
  handle(task: ScheduledTask): Promise<void>;
}

/**
 * Despierta al trabajador pronto (una tarea vence en segundos y no debe
 * esperar a la próxima ronda programada). Nunca bloquea ni lanza.
 */
export interface TaskKicker {
  kick(): void;
}

/**
 * Despertador a una hora exacta, fuera del proceso (p. ej. un mensaje con
 * retraso en Vercel Queues). Sin cron frecuente, asegura que el trabajador
 * corra cuando vence una tarea lejana aunque nadie escriba. Varias peticiones
 * para la misma hora suenan una vez. Nunca lanza: `false` si no pudo armarlo.
 */
export interface TaskAlarm {
  ringAt(at: Date): Promise<boolean>;
}

export interface Clock {
  now(): Date;
}

export type TaskSleep = (ms: number) => Promise<void>;
