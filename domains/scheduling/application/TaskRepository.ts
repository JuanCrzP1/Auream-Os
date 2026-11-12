import type { NewTask, ScheduledTask } from "../domain/ScheduledTask";

/**
 * Almacén de la cola. Las operaciones de reserva deben ser atómicas entre
 * procesos: dos trabajadores a la vez nunca toman la misma tarea.
 */
export interface TaskRepository {
  /** La agrega si su `dedupeKey` es nueva. `false` si ya existía. */
  enqueue(id: string, task: NewTask): Promise<boolean>;
  /** Cancela las pendientes de un grupo (salvo la de `except`). Devuelve cuántas. */
  cancelGroup(tenantId: string, groupKey: string, except?: string): Promise<number>;
  /**
   * Reserva hasta `limit` tareas vencidas (o con la reserva caducada), de la
   * más antigua a la más nueva: pasan a `running`, suman un intento y quedan
   * reservadas `leaseMs`.
   */
  claimDue(now: Date, limit: number, leaseMs: number): Promise<ScheduledTask[]>;
  /**
   * Las pendientes de un grupo que vencen después de `to` pasan a vencer en
   * `to` (adelantar el tiempo, solo desarrollo). Devuelve cuándo vencían.
   */
  advanceGroup(tenantId: string, groupKey: string, to: Date): Promise<Date[]>;
  complete(id: string, now: Date): Promise<void>;
  /** Vuelve a `pending` para otro intento a `nextDueAt`. */
  retry(id: string, error: string, nextDueAt: Date): Promise<void>;
  /** Termina sin éxito (sin más intentos). */
  fail(id: string, error: string, now: Date): Promise<void>;
  /** La próxima pendiente con trabajo (sin eslabones de cadena): cuándo vence y de qué cuenta. */
  peekNext(): Promise<{ readonly dueAt: Date; readonly tenantId: string } | null>;
  /** Borra tareas terminadas antes de `before` (limpieza). Devuelve cuántas. */
  purgeFinished(before: Date, limit: number): Promise<number>;
}
