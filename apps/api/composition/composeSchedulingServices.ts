import type { ApiConfig } from "../config/loadApiConfig";
import type { SqlClient } from "../../../infrastructure/persistence/sql/SqlClient";
import type { BackgroundTasks } from "../http/BackgroundTasks";
import { SqlTaskRepository } from "../../../infrastructure/persistence/sql/SqlTaskRepository";
import { HttpTaskKicker, InProcessTaskKicker } from "../../../infrastructure/scheduling/TaskKickers";
import { VercelQueueTaskAlarm } from "../../../infrastructure/scheduling/VercelQueueTaskAlarm";
import { KICK_HORIZON_MS, NO_ALARM, systemClock, TaskScheduler } from "../../../domains/scheduling/application/TaskScheduler";
import { randomUUID } from "node:crypto";
import { send } from "@vercel/queue";
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
// si no, en el mismo proceso. Lo que vence más tarde, con un despertador de
// Vercel Queues a su hora (`config.tasks.alarms`).
// ---------------------------------------------------------------------------

export interface SchedulingServices {
  readonly scheduler: TaskScheduler;
  /** Crea el trabajador con los manejadores de cada tipo de tarea. Una sola vez. */
  attachHandlers(handlers: ReadonlyArray<TaskHandler>): TaskRunner;
}

export function composeSchedulingServices(
  config: ApiConfig,
  sql: SqlClient,
  background: BackgroundTasks,
  onTaskError: (task: ScheduledTask, error: unknown) => void = () => undefined,
  onAlarmError: (error: unknown) => void = () => undefined
): SchedulingServices {
  const repository = new SqlTaskRepository(sql);
  let runner: TaskRunner | null = null;
  const runInProcess = () => (runner ? runner.run({ budgetMs: Math.min(config.tasks.runnerBudgetMs, 40_000) }) : Promise.resolve());
  const runInBackground = (work: () => Promise<unknown>) => background.run(work);

  const kicker =
    config.tasks.runUrl && config.tasks.cronSecret
      ? new HttpTaskKicker(config.tasks.runUrl, config.tasks.cronSecret, runInBackground)
      : new InProcessTaskKicker(runInProcess, runInBackground);
  const alarm = config.tasks.alarms ? new VercelQueueTaskAlarm((topic, payload, options) => send(topic, payload, options), onAlarmError) : NO_ALARM;

  return {
    // Con cadena de rondas, lo que vence dentro de su margen la arranca enseguida.
    scheduler: new TaskScheduler(repository, kicker, systemClock, randomUUID, {
      kickHorizonMs: Math.max(KICK_HORIZON_MS, config.tasks.chainHorizonMs),
      alarm
    }),
    attachHandlers(handlers) {
      if (runner) throw new Error("La cola ya tiene su trabajador.");
      runner = new TaskRunner(repository, handlers, {}, systemClock, undefined, onTaskError);
      return runner;
    }
  };
}
