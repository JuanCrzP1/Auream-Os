import { randomUUID } from "node:crypto";
import { CHAIN_BUCKET_MS, CHAIN_TASK_KIND, type NewTask } from "../domain/ScheduledTask";
import type { TaskRepository } from "./TaskRepository";
import type { Clock, TaskAlarm, TaskKicker } from "./ports/TaskPorts";

// ---------------------------------------------------------------------------
// TaskScheduler — lo que el resto de la plataforma usa para programar trabajo
// a futuro. Idempotente por `dedupeKey`. Quién despierta al trabajador:
//
//   · vence pronto (`kickHorizonMs`): lo despierta ya (la ronda lo espera)
//   · vence más tarde: arma un DESPERTADOR que suena `alarmLeadMs` ANTES de
//     la hora (`TaskAlarm`); la ronda que despierta espera la hora exacta, así
//     ni la demora de la cola ni el arranque de las funciones atrasan nada. Al
//     terminar cada ronda se arma el de la siguiente pendiente (`armNext`):
//     así se cubren reintentos, alarmas perdidas y esperas de más de una semana
//
// CADENA DE RONDAS (sin despertador ni cron frecuente): mientras haya trabajo
// que vence dentro de `chainHorizonMs`, cada ronda, al terminar, despierta a la
// siguiente (`continueIfSoon`). Una sola cadena a la vez: el eslabón es una
// tarea con clave única por tramo de 30 s.
// ---------------------------------------------------------------------------

/**
 * Lo que vence dentro de este margen despierta ya al trabajador: la ronda lo
 * espera. Debe quedar por debajo de lo que una ronda puede esperar (su tiempo
 * menos la reserva para terminar: 50 − 25 = 25 s por defecto); si no, la ronda
 * termina sin atenderlo y despierta otra en vano. Lo demás, su despertador.
 */
export const KICK_HORIZON_MS = 20_000;

/**
 * El despertador suena este tiempo ANTES de la hora: la ronda que despierta
 * llega con margen y espera la hora exacta. Nunca más que `kickHorizonMs`
 * (lo que una ronda puede esperar).
 */
export const ALARM_LEAD_MS = 15_000;

export const systemClock: Clock = { now: () => new Date() };

/** Sin despertador externo (desarrollo, o apagado): cubren la cadena, los mensajes y el cron. */
export const NO_ALARM: TaskAlarm = { ringAt: async () => false };

export interface TaskSchedulerOptions {
  /** Lo que vence dentro de este margen despierta al trabajador (o arranca la cadena). */
  readonly kickHorizonMs?: number;
  readonly alarm?: TaskAlarm;
  /** Cuánto antes de la hora suena el despertador (por defecto `ALARM_LEAD_MS`). */
  readonly alarmLeadMs?: number;
}

export class TaskScheduler {
  private readonly kickHorizonMs: number;
  private readonly alarm: TaskAlarm;
  private readonly alarmLeadMs: number;

  public constructor(
    private readonly repository: TaskRepository,
    private readonly kicker: TaskKicker,
    private readonly clock: Clock = systemClock,
    private readonly newId: () => string = randomUUID,
    options: TaskSchedulerOptions = {}
  ) {
    this.kickHorizonMs = options.kickHorizonMs ?? KICK_HORIZON_MS;
    this.alarm = options.alarm ?? NO_ALARM;
    this.alarmLeadMs = Math.min(options.alarmLeadMs ?? ALARM_LEAD_MS, this.kickHorizonMs);
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
   * Red de seguridad (mensajes entrantes, tráfico de la app): si algo ya venció
   * o vence dentro de `kickHorizonMs`, despierta al trabajador, que espera la
   * hora exacta. Así lo que vence sigue a su hora aunque su despertador se
   * pierda. Una consulta; nunca lanza.
   */
  public async nudgeIfDue(): Promise<void> {
    const next = await this.repository.peekNext().catch(() => null);
    if (next && next.dueAt.getTime() - this.clock.now().getTime() <= this.kickHorizonMs) this.kicker.kick();
  }

  /** Pronto: despertar ya. Más tarde: el despertador, con margen antes de la hora. */
  private async wakeFor(dueAt: Date): Promise<void> {
    if (dueAt.getTime() - this.clock.now().getTime() <= this.kickHorizonMs) this.kicker.kick();
    else await this.alarm.ringAt(new Date(dueAt.getTime() - this.alarmLeadMs));
  }
}
