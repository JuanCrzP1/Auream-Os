import { ApiConfigError } from "./ApiConfigError";

/**
 * Cola de tareas (FASE C6).
 *   cronSecret      `CRON_SECRET`: protege `/internal/tasks/run` (Vercel Cron lo
 *                   envía como `Authorization: Bearer …`). Sin él, el endpoint
 *                   no atiende y la cola solo corre dentro del propio proceso.
 *   selfBaseUrl     dirección pública de esta API para despertar al trabajador
 *                   en otra invocación (producción en Vercel). `null`: en proceso.
 *   runnerBudgetMs  cuánto dura una ronda del trabajador (bajo `maxDuration`).
 *   chainHorizonMs  cadena de rondas (planes sin cron frecuente, p. ej. Vercel
 *                   Hobby): mientras algo venza dentro de este margen, cada ronda
 *                   despierta a la siguiente. 0 la apaga (cron cada minuto).
 */
export interface TasksConfig {
  readonly cronSecret: string | null;
  readonly selfBaseUrl: string | null;
  readonly runnerBudgetMs: number;
  readonly chainHorizonMs: number;
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
  const selfBaseUrl = env["TASKS_BASE_URL"]?.trim().replace(/\/+$/, "") || (productionHost ? `https://${productionHost}/api` : null);
  const chainHorizonMs = Number(env["TASK_CHAIN_HORIZON_MS"] ?? 900_000);
  if (!Number.isInteger(chainHorizonMs) || chainHorizonMs < 0 || chainHorizonMs > 86_400_000) {
    throw new ApiConfigError("TASK_CHAIN_HORIZON_MS debe estar entre 0 (apagada) y 86400000.");
  }
  return { cronSecret, selfBaseUrl: cronSecret ? selfBaseUrl : null, runnerBudgetMs, chainHorizonMs };
}
