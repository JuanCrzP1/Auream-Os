import { randomUUID } from "node:crypto";
import { CHAIN_BUCKET_MS, CHAIN_TASK_KIND, type NewTask } from "../domain/ScheduledTask";
import type { TaskRepository } from "./TaskRepository";
import type { Clock, TaskAlarm, TaskKicker } from "./ports/TaskPorts";

// ---------------------------------------------------------------------------
// TaskScheduler — lo que el resto de la plataforma usa para programar trabajo
// a futuro. Idempotente por `dedupeKey`. Quién despierta al trabajador:
//
//   · vence pronto (`kickHorizonMs`): lo despierta ya (la ronda lo espera)
//   · vence más tarde: arma un DESPERTADOR a esa hora (`TaskAlarm`); al
//     terminar cada ronda se arma el de la siguiente pendiente (`armNext`):
//     así se cubren reintentos, alarmas perdidas y esperas de más de una semana
//
// CADENA DE RONDAS (sin despertador ni cron frecuente): mientras haya trabajo
// que vence dentro de `chainHorizonMs`, cada ronda, al terminar, despierta a la
// siguiente (`continueIfSoon`). Una sola cadena a la vez: el eslabón es una
// tarea con clave única por tramo de 30 s.
// ---------------------------------------------------------------------------

/** Lo que vence dentro de este margen se atiende enseguida (no espera la ronda). */
export const KICK_HORIZON_MS = 45_000;

export const systemClock: Clock = { now: () => new Date() };

/** Sin despertador externo (desarrollo, o apagado): cubren la cadena, los mensajes y el cron. */
export const NO_ALARM: TaskAlarm = { ringAt: async () => false };

export interface TaskSchedulerOptions {
  /** Lo que vence dentro de este margen despierta al trabajador (o arranca la cadena). */
  readonly kickHorizonMs?: number;
  readonly alarm?: TaskAlarm;
}

export class TaskScheduler {
  private readonly kickHorizonMs: number;
  private readonly alarm: TaskAlarm;

  public constructor(
    private readonly repository: TaskRepository,
    private readonly kicker: TaskKicker,
    private readonly clock: Clock = systemClock,
    private readonly newId: () => string = randomUUID,
    options: TaskSchedulerOptions = {}
  ) {
    this.kickHorizonMs = options.kickHorizonMs ?? KICK_HORIZON_MS;
    this.alarm = options.alarm ?? NO_ALARM;
  }

  /** Programa la tarea. `false` si ya estaba programada (misma `dedupeKey`). */
  public async schedule(task: NewTask): Promise<boolean> {
    const created = await this.repository.enqueue(this.newId(), task);
    if (created) await this.wakeFor(task.dueAt);
    return created;
  }

  /**
   * Al terminar una ronda: asegura quién despierta para la próxima pendiente
   * (ya, o su despertador). Nunca lanza.
   */
  public async armNext(): Promise<void> {
    const next = await this.repository.peekNext().catch(() => null);
    if (next) await this.wakeFor(next.dueAt);
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

  /** Pronto: despertar ya. Más tarde: el despertador a esa hora. */
  private async wakeFor(dueAt: Date): Promise<void> {
    if (dueAt.getTime() - this.clock.now().getTime() <= this.kickHorizonMs) this.kicker.kick();
    else await this.alarm.ringAt(dueAt);
  }
}
