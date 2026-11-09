import type { ApiConfig } from "../config/loadApiConfig";
import type { SqlClient } from "../../../infrastructure/persistence/sql/SqlClient";
import type { BackgroundTasks } from "../http/BackgroundTasks";
import { SqlTaskRepository } from "../../../infrastructure/persistence/sql/SqlTaskRepository";
import { HttpTaskKicker, InProcessTaskKicker } from "../../../infrastructure/scheduling/TaskKickers";
import { KICK_HORIZON_MS, systemClock, TaskScheduler } from "../../../domains/scheduling/application/TaskScheduler";
import { randomUUID } from "node:crypto";
import { TaskRunner } from "../../../domains/scheduling/application/TaskRunner";
import type { TaskHandler } from "../../../domains/scheduling/application/ports/TaskPorts";
import type { ScheduledTask } from "../../../domains/scheduling/domain/ScheduledTask";

// ---------------------------------------------------------------------------
// composeSchedulingServices — la cola de tareas (FASE C6) en Neon.
//
// En dos pasos porque los manejadores (p. ej. los despertadores de los flujos)
// usan el programador al componerse: primero el programador, después el
// trabajador con sus manejadores (`attachHandlers`).
//
// Despertar al trabajador cuando algo vence en segundos: en producción, por
// HTTP en una invocación nueva (`/internal/tasks/run`, con `CRON_SECRET`);
// si no, en el mismo proceso.
// ---------------------------------------------------------------------------

export const TASKS_RUN_PATH = "/internal/tasks/run";

export interface SchedulingServices {
  readonly scheduler: TaskScheduler;
  /** Crea el trabajador con los manejadores de cada tipo de tarea. Una sola vez. */
  attachHandlers(handlers: ReadonlyArray<TaskHandler>): TaskRunner;
}

export function composeSchedulingServices(
  config: ApiConfig,
  sql: SqlClient,
  background: BackgroundTasks,
  onTaskError: (task: ScheduledTask, error: unknown) => void = () => undefined
): SchedulingServices {
  const repository = new SqlTaskRepository(sql);
  let runner: TaskRunner | null = null;
  const runInProcess = () => (runner ? runner.run({ budgetMs: Math.min(config.tasks.runnerBudgetMs, 40_000) }) : Promise.resolve());
  const runInBackground = (work: () => Promise<unknown>) => background.run(work);

  const kicker =
    config.tasks.selfBaseUrl && config.tasks.cronSecret
      ? new HttpTaskKicker(`${config.tasks.selfBaseUrl}${TASKS_RUN_PATH}`, config.tasks.cronSecret, runInBackground)
      : new InProcessTaskKicker(runInProcess, runInBackground);

  return {
    // Con cadena de rondas, lo que vence dentro de su margen la arranca enseguida.
    scheduler: new TaskScheduler(repository, kicker, systemClock, randomUUID, Math.max(KICK_HORIZON_MS, config.tasks.chainHorizonMs)),
    attachHandlers(handlers) {
      if (runner) throw new Error("La cola ya tiene su trabajador.");
      runner = new TaskRunner(repository, handlers, {}, systemClock, undefined, onTaskError);
      return runner;
    }
  };
}
