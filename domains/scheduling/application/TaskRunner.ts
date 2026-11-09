import { CHAIN_TASK_KIND, DEFAULT_MAX_ATTEMPTS, PermanentTaskError, retryDelayMs, type ScheduledTask } from "../domain/ScheduledTask";
import type { TaskRepository } from "./TaskRepository";
import type { Clock, TaskHandler, TaskSleep } from "./ports/TaskPorts";
import { systemClock } from "./TaskScheduler";

// ---------------------------------------------------------------------------
// TaskRunner — el trabajador de la cola. Una RONDA con tiempo limitado (una
// función de Vercel vive hasta `maxDuration`):
//
//   1. reserva cada tarea EN SU HORA (atómico entre procesos) y la arranca sin
//      esperar a las que ya corren: un turno largo (pausas de «escribiendo…»)
//      no atrasa el intervalo de otro chat. Hasta `concurrency` a la vez
//   2. bien → hecha · error → otro intento más tarde (30 s, 2 min, 8 min…)
//      · sin intentos o error definitivo → fallida, con su motivo
//   3. si no hay vencidas pero alguna vence antes de que acabe la ronda, la
//      espera hasta el milisegundo de su hora. Con `holdWithinMs`, se queda
//      hasta el final de la ronda si algo vence dentro de ese margen (cadena de
//      rondas: la siguiente la despierta el programador)
//
// Solo toma tareas nuevas si queda tiempo para terminarlas (`reserveMs`). Si
// el proceso muere a mitad, la reserva caduca y otra ronda la retoma.
// ---------------------------------------------------------------------------

export interface RunnerOptions {
  /** Tareas por reserva. */
  readonly batchSize: number;
  /** Cuántas se ejecutan a la vez. */
  readonly concurrency: number;
  /** Cuánto dura una reserva: más que lo que puede tardar una tarea. */
  readonly leaseMs: number;
  /** Tiempo mínimo que debe quedar en la ronda para tomar una tarea. */
  readonly reserveMs: number;
  /** Cada cuánto se vuelve a mirar la cola mientras se espera una tarea próxima. */
  readonly pollMs: number;
  /** Cuánto se guardan las tareas terminadas antes de borrarlas. */
  readonly retentionMs: number;
}

export const DEFAULT_RUNNER_OPTIONS: RunnerOptions = {
  batchSize: 10,
  // Los turnos casi solo esperan (pausas, red): muchos caben a la vez.
  concurrency: 16,
  leaseMs: 120_000,
  reserveMs: 25_000,
  pollMs: 2_000,
  retentionMs: 7 * 86_400_000
};

export interface RunReport {
  readonly claimed: number;
  readonly completed: number;
  readonly retried: number;
  readonly failed: number;
  readonly purged: number;
  /** Lo más tarde que corrió una tarea de la ronda (ms tras su hora). Muy alto = algo no la despertó. */
  readonly maxLateMs: number;
  readonly durationMs: number;
}

/** Respiro cuando lo vencido está reservado por otra ronda (o no hay lugar libre). */
const BUSY_RETRY_MS = 250;

type Outcome = "completed" | "retried" | "failed";
type Totals = Record<Outcome | "claimed" | "purged" | "maxLateMs", number>;

const realSleep: TaskSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export class TaskRunner {
  private readonly handlers: ReadonlyMap<string, TaskHandler>;
  private readonly options: RunnerOptions;

  public constructor(
    private readonly repository: TaskRepository,
    handlers: ReadonlyArray<TaskHandler>,
    options: Partial<RunnerOptions> = {},
    private readonly clock: Clock = systemClock,
    private readonly sleep: TaskSleep = realSleep,
    private readonly onError: (task: ScheduledTask, error: unknown) => void = () => undefined
  ) {
    this.handlers = new Map(handlers.map((handler) => [handler.kind, handler]));
    this.options = { ...DEFAULT_RUNNER_OPTIONS, ...options };
  }

  /**
   * Una ronda de hasta `budgetMs`. Con `waitForUpcoming`, espera dentro de la
   * ronda las tareas que vencen antes de que termine.
   */
  public async run({
    budgetMs,
    waitForUpcoming = true,
    holdWithinMs = 0
  }: { readonly budgetMs: number; readonly waitForUpcoming?: boolean; readonly holdWithinMs?: number }): Promise<RunReport> {
    const started = this.clock.now().getTime();
    const deadline = started + budgetMs;
    const totals: Totals = { claimed: 0, completed: 0, retried: 0, failed: 0, purged: 0, maxLateMs: 0 };
    const remaining = () => deadline - this.clock.now().getTime();
    // Una ronda más corta que la reserva igual toma su primer lote (si no, nunca haría nada).
    const reserveMs = Math.min(this.options.reserveMs, budgetMs);
    const running = new Set<Promise<void>>();

    while (remaining() >= reserveMs) {
      const free = this.options.concurrency - running.size;
      if (free > 0) {
        const tasks = await this.repository.claimDue(this.clock.now(), Math.min(free, this.options.batchSize), this.options.leaseMs);
        if (tasks.length > 0) {
          this.start(tasks, running, totals);
          continue;
        }
      }
      const peek = await this.repository.peekNext();
      const next = peek?.dueAt.getTime() ?? null;
      const now = this.clock.now().getTime();
      const dueInRound = waitForUpcoming && next !== null && next <= deadline - reserveMs;
      const holding = next !== null && holdWithinMs > 0 && next - now <= holdWithinMs;
      if (!dueInRound && !holding) {
        // Nada que vaya a vencer con tiempo útil (ni que sostener): termina cuando acaben las que corren.
        if (running.size === 0) break;
        await Promise.race(running);
        continue;
      }
      // Hasta la hora EXACTA (de a `pollMs` como mucho, por si llega algo antes), o
      // hasta que se libere un lugar. Ya vencida pero reservada por otra ronda, o
      // sin lugar libre: un respiro para no girar en vacío.
      const untilDue = next! - now;
      const pause = this.sleep(untilDue > 0 ? Math.min(untilDue, this.options.pollMs) : BUSY_RETRY_MS);
      await (running.size > 0 ? Promise.race([pause, ...running]) : pause);
    }
    await Promise.all(running);

    totals.purged = await this.repository
      .purgeFinished(new Date(this.clock.now().getTime() - this.options.retentionMs), 500)
      .catch(() => 0);
    return { ...totals, durationMs: this.clock.now().getTime() - started };
  }

  /** Arranca las reservadas sin esperarlas (las sigue `running`) y anota cuán tarde se tomaron. */
  private start(tasks: ReadonlyArray<ScheduledTask>, running: Set<Promise<void>>, totals: Totals): void {
    totals.claimed += tasks.length;
    const claimedAt = this.clock.now().getTime();
    for (const task of tasks) {
      totals.maxLateMs = Math.max(totals.maxLateMs, claimedAt - Date.parse(task.dueAt));
      const job: Promise<void> = this.execute(task)
        .then((outcome) => void (totals[outcome] += 1))
        // Si ni siquiera se pudo anotar el resultado, la reserva caduca y otra ronda la retoma.
        .catch((error: unknown) => this.onError(task, error))
        .finally(() => running.delete(job));
      running.add(job);
    }
  }

  private async execute(task: ScheduledTask): Promise<Outcome> {
    const handler = this.handlers.get(task.kind);
    try {
      // Eslabón de la cadena de rondas: no tiene trabajo.
      if (task.kind === CHAIN_TASK_KIND) {
        await this.repository.complete(task.id, this.clock.now());
        return "completed";
      }
      if (!handler) throw new PermanentTaskError(`No hay manejador para «${task.kind}».`);
      await handler.handle(task);
      await this.repository.complete(task.id, this.clock.now());
      return "completed";
    } catch (error) {
      this.onError(task, error);
      const message = (error instanceof Error ? error.message : String(error)).slice(0, 500);
      const maxAttempts = task.maxAttempts || DEFAULT_MAX_ATTEMPTS;
      if (error instanceof PermanentTaskError || task.attempts >= maxAttempts) {
        await this.repository.fail(task.id, message, this.clock.now());
        return "failed";
      }
      await this.repository.retry(task.id, message, new Date(this.clock.now().getTime() + retryDelayMs(task.attempts)));
      return "retried";
    }
  }
}
