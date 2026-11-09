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

export interface Clock {
  now(): Date;
}

export type TaskSleep = (ms: number) => Promise<void>;
