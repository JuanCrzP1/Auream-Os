import { ApiConfigError } from "./ApiConfigError";

/** Dónde escucha el trabajador de la cola (bajo `/api` en Vercel). */
export const TASKS_RUN_PATH = "/internal/tasks/run";

/**
 * Cola de tareas (FASE C6).
 *   cronSecret      `CRON_SECRET`: protege `/internal/tasks/run` (Vercel Schedules
 *                   lo envía como `Authorization: Bearer …`). Sin él, el endpoint
 *                   no atiende y la cola solo corre dentro del propio proceso.
 *   selfBaseUrl     dirección pública de esta API para despertar al trabajador
 *                   en otra invocación (producción en Vercel). `null`: en proceso.
 *   runUrl          `selfBaseUrl` + `TASKS_RUN_PATH` (o `null`).
 *   runnerBudgetMs  cuánto dura una ronda del trabajador (bajo `maxDuration`).
 *   alarms          despertadores con Vercel Queues (`TASK_ALARMS`): cada tarea
 *                   lejana suena a su hora sin cron frecuente ni funciones
 *                   esperando. Por defecto, en Vercel con `CRON_SECRET`.
 *   chainHorizonMs  cadena de rondas (sin despertadores ni cron frecuente):
 *                   mientras algo venza dentro de este margen, cada ronda
 *                   despierta a la siguiente. 0 la apaga. Por defecto 15 min sin
 *                   despertadores y 0 con ellos.
 */
export interface TasksConfig {
  readonly cronSecret: string | null;
  readonly selfBaseUrl: string | null;
  readonly runUrl: string | null;
  readonly runnerBudgetMs: number;
  readonly alarms: boolean;
  readonly chainHorizonMs: number;
}

/** El dominio de producción del proyecto en Vercel (solo en el despliegue de producción). */
export function productionHostOf(env: NodeJS.ProcessEnv): string {
  return env["VERCEL_ENV"] === "production" ? (env["VERCEL_PROJECT_PRODUCTION_URL"]?.trim() ?? "") : "";
}

function alarmsSetting(env: NodeJS.ProcessEnv): boolean {
  const value = env["TASK_ALARMS"]?.trim().toLowerCase();
  if (value === undefined || value === "") return env["VERCEL"] === "1";
  if (value === "on" || value === "off") return value === "on";
  throw new ApiConfigError("TASK_ALARMS debe ser «on» u «off».");
}

export function loadTasksConfig(env: NodeJS.ProcessEnv, productionHost: string | undefined): TasksConfig {
  const cronSecret = env["CRON_SECRET"]?.trim() || null;
  if (cronSecret && cronSecret.length < 16) {
    throw new ApiConfigError("CRON_SECRET debe tener al menos 16 caracteres (es la llave del trabajador de la cola).");
  }
  const runnerBudgetMs = Number(env["TASK_RUNNER_BUDGET_MS"] || 50_000);
  if (!Number.isInteger(runnerBudgetMs) || runnerBudgetMs < 10_000 || runnerBudgetMs > 290_000) {
    throw new ApiConfigError("TASK_RUNNER_BUDGET_MS debe estar entre 10000 y 290000 (y por debajo del maxDuration de la función).");
  }
  // Por defecto, el dominio oficial de producción: no lleva la protección de despliegues de Vercel.
  const base = env["TASKS_BASE_URL"]?.trim().replace(/\/+$/, "") || (productionHost ? `https://${productionHost}/api` : null);
  const selfBaseUrl = cronSecret ? base : null;
  // Un despertador solo sirve si puede llamar al trabajador de producción con su clave.
  const alarms = alarmsSetting(env) && selfBaseUrl !== null;
  const chainHorizonMs = Number(env["TASK_CHAIN_HORIZON_MS"] || (alarms ? 0 : 900_000));
  if (!Number.isInteger(chainHorizonMs) || chainHorizonMs < 0 || chainHorizonMs > 86_400_000) {
    throw new ApiConfigError("TASK_CHAIN_HORIZON_MS debe estar entre 0 (apagada) y 86400000.");
  }
  return { cronSecret, selfBaseUrl, runUrl: selfBaseUrl ? `${selfBaseUrl}${TASKS_RUN_PATH}` : null, runnerBudgetMs, alarms, chainHorizonMs };
}
