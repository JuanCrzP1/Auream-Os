import { randomUUID } from "node:crypto";
import { CHAIN_BUCKET_MS, CHAIN_TASK_KIND, type NewTask } from "../domain/ScheduledTask";
import type { TaskRepository } from "./TaskRepository";
import type { Clock, TaskKicker } from "./ports/TaskPorts";

// ---------------------------------------------------------------------------
// TaskScheduler — lo que el resto de la plataforma usa para programar trabajo
// a futuro. Idempotente por `dedupeKey`. Si la tarea vence pronto, despierta
// al trabajador para que no espere a la próxima ronda programada.
//
// CADENA DE RONDAS (planes sin cron frecuente, p. ej. Vercel Hobby): mientras
// haya trabajo que vence dentro de `chainHorizonMs`, cada ronda, al terminar,
// despierta a la siguiente (`continueIfSoon`). Una sola cadena a la vez: el
// eslabón es una tarea con clave única por tramo de 30 s.
// ---------------------------------------------------------------------------

/** Lo que vence dentro de este margen se atiende enseguida (no espera la ronda). */
export const KICK_HORIZON_MS = 45_000;

export const systemClock: Clock = { now: () => new Date() };

export class TaskScheduler {
  public constructor(
    private readonly repository: TaskRepository,
    private readonly kicker: TaskKicker,
    private readonly clock: Clock = systemClock,
    private readonly newId: () => string = randomUUID,
    /** Lo que vence dentro de este margen despierta al trabajador (o arranca la cadena). */
    private readonly kickHorizonMs: number = KICK_HORIZON_MS
  ) {}

  /** Programa la tarea. `false` si ya estaba programada (misma `dedupeKey`). */
  public async schedule(task: NewTask): Promise<boolean> {
    const created = await this.repository.enqueue(this.newId(), task);
    if (created && task.dueAt.getTime() - this.clock.now().getTime() <= this.kickHorizonMs) this.kicker.kick();
    return created;
  }

  /**
   * Al terminar una ronda: si hay trabajo que vence dentro de `horizonMs`,
   * despierta la siguiente. Solo una ronda por tramo gana el eslabón.
   */
  public async continueIfSoon(horizonMs: number): Promise<boolean> {
    if (horizonMs <= 0) return false;
    const now = this.clock.now().getTime();
    const next = await this.repository.peekNext();
    if (!next || next.dueAt.getTime() - now > horizonMs) return false;
    const won = await this.repository.enqueue(this.newId(), {
      tenantId: next.tenantId,
      kind: CHAIN_TASK_KIND,
      groupKey: CHAIN_TASK_KIND,
      dedupeKey: `${CHAIN_TASK_KIND}:${Math.floor(now / CHAIN_BUCKET_MS)}`,
      payload: {},
      dueAt: new Date(now)
    });
    if (won) this.kicker.kick();
    return won;
  }

  /** La deja como ÚNICA pendiente de su grupo (cancela las demás del grupo). */
  public async replaceInGroup(task: NewTask): Promise<boolean> {
    await this.repository.cancelGroup(task.tenantId, task.groupKey, task.dedupeKey);
    return this.schedule(task);
  }

  public cancelGroup(tenantId: string, groupKey: string): Promise<number> {
    return this.repository.cancelGroup(tenantId, groupKey);
  }

  /**
   * Red de seguridad: si hay tareas YA vencidas (p. ej. no corrió la ronda
   * programada), despierta al trabajador. Una consulta; nunca lanza.
   */
  public async nudgeIfDue(): Promise<void> {
    const next = await this.repository.peekNext().catch(() => null);
    if (next && next.dueAt.getTime() <= this.clock.now().getTime()) this.kicker.kick();
  }
}
