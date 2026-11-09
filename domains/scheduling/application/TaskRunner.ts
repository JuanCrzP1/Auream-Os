import { CHAIN_TASK_KIND, DEFAULT_MAX_ATTEMPTS, PermanentTaskError, retryDelayMs, type ScheduledTask } from "../domain/ScheduledTask";
import type { TaskRepository } from "./TaskRepository";
import type { Clock, TaskHandler, TaskSleep } from "./ports/TaskPorts";
import { systemClock } from "./TaskScheduler";

// ---------------------------------------------------------------------------
// TaskRunner — el trabajador de la cola. Una RONDA con tiempo limitado (una
// función de Vercel vive hasta `maxDuration`):
//
//   1. reserva las tareas vencidas (de a lotes, atómico entre procesos)
//   2. las ejecuta con su manejador, varias a la vez
//   3. bien → hecha · error → otro intento más tarde (30 s, 2 min, 8 min…)
//      · sin intentos o error definitivo → fallida, con su motivo
//   4. si no hay vencidas pero alguna vence antes de que acabe la ronda, la
//      espera (así una pausa de 30 s no aguarda a la próxima ronda). Con
//      `holdWithinMs`, se queda hasta el final de la ronda si algo vence dentro
//      de ese margen (cadena de rondas: la siguiente la despierta el programador)
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
  concurrency: 4,
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
  readonly durationMs: number;
}

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
    const totals = { claimed: 0, completed: 0, retried: 0, failed: 0, purged: 0 };
    const remaining = () => deadline - this.clock.now().getTime();
    // Una ronda más corta que la reserva igual toma su primer lote (si no, nunca haría nada).
    const reserveMs = Math.min(this.options.reserveMs, budgetMs);

    while (remaining() >= reserveMs) {
      const tasks = await this.repository.claimDue(this.clock.now(), this.options.batchSize, this.options.leaseMs);
      if (tasks.length > 0) {
        totals.claimed += tasks.length;
        for (const outcome of await this.executeAll(tasks)) totals[outcome] += 1;
        continue;
      }
      if (!waitForUpcoming) break;
      const peek = await this.repository.peekNext();
      const next = peek?.dueAt.getTime() ?? null;
      const now = this.clock.now().getTime();
      const dueInRound = next !== null && next <= deadline - reserveMs;
      const holding = next !== null && holdWithinMs > 0 && next - now <= holdWithinMs;
      // Nada que vaya a vencer mientras quede tiempo útil en la ronda (ni que sostener): termina.
      if (!dueInRound && !holding) break;
      // Mínimo 250 ms: si otra ronda tiene reservada la vencida, no se gira en vacío.
      await this.sleep(Math.min(Math.max(next! - now, 250), this.options.pollMs));
    }

    totals.purged = await this.repository
      .purgeFinished(new Date(this.clock.now().getTime() - this.options.retentionMs), 500)
      .catch(() => 0);
    return { ...totals, durationMs: this.clock.now().getTime() - started };
  }

  /** Ejecuta un lote con concurrencia limitada. */
  private async executeAll(tasks: ReadonlyArray<ScheduledTask>): Promise<Array<"completed" | "retried" | "failed">> {
    const outcomes: Array<"completed" | "retried" | "failed"> = [];
    let next = 0;
    const worker = async () => {
      while (next < tasks.length) {
        const task = tasks[next++]!;
        outcomes.push(await this.execute(task));
      }
    };
    await Promise.all(Array.from({ length: Math.min(this.options.concurrency, tasks.length) }, worker));
    return outcomes;
  }

  private async execute(task: ScheduledTask): Promise<"completed" | "retried" | "failed"> {
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
