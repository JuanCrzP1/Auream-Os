import { timingSafeEqual } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { TaskRunner, RunReport } from "../../../domains/scheduling/application/TaskRunner";
import type { BackgroundTasks } from "../http/BackgroundTasks";
import { sendJson } from "../http/sendJson";
import { TASKS_RUN_PATH } from "../config/loadTasksConfig";

// ---------------------------------------------------------------------------
// `/internal/tasks/run` — despierta al trabajador de la cola (FASE C6).
//
// Lo llaman la tarea programada de Vercel, la cadena de rondas y la API cuando
// algo vence en segundos. No es de usuarios: exige `Authorization: Bearer
// <CRON_SECRET>` (Vercel Cron lo envía solo). Sin `CRON_SECRET` configurado no
// atiende a nadie.
//
// Responde enseguida (202) y la ronda sigue en segundo plano dentro del tiempo
// de la función: así quien llama no espera ni corta el trabajo. Al terminar,
// asegura quién despierta para la próxima pendiente (`armNext`: ya, o su
// despertador). Con cadena de rondas (sin despertadores ni cron frecuente), la
// ronda se sostiene si algo vence pronto y, al terminar, despierta a la siguiente.
// ---------------------------------------------------------------------------

export interface InternalTasksDependencies {
  readonly runner: TaskRunner;
  readonly cronSecret: string | null;
  readonly budgetMs: number;
  readonly background: BackgroundTasks;
  /** Cadena de rondas: margen (0 = apagada) y cómo despertar la siguiente. */
  readonly chain?: { readonly horizonMs: number; continueIfSoon(horizonMs: number): Promise<boolean> };
  /** Tras cada ronda: el despertador (o el aviso) de la próxima pendiente. */
  readonly armNext?: () => Promise<void>;
  readonly onReport?: (report: RunReport) => void;
}

function authorized(header: string | undefined, secret: string): boolean {
  const given = Buffer.from(header ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function routeInternalTasks(
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  tasks: InternalTasksDependencies | undefined
): Promise<boolean> {
  if (url.pathname !== TASKS_RUN_PATH) return false;
  const method = request.method ?? "GET";
  if (method !== "GET" && method !== "POST") {
    sendJson(response, 405, { message: "Method not allowed" });
    return true;
  }
  if (!tasks || !tasks.cronSecret) {
    sendJson(response, 503, { message: "La cola de tareas no está configurada." });
    return true;
  }
  if (!authorized(request.headers.authorization, tasks.cronSecret)) {
    sendJson(response, 401, { message: "Authentication required" });
    return true;
  }

  const chain = tasks.chain;
  tasks.background.run(async () => {
    const report = await tasks.runner.run({ budgetMs: tasks.budgetMs, holdWithinMs: chain?.horizonMs ?? 0 });
    tasks.onReport?.(report);
    if (chain) await chain.continueIfSoon(chain.horizonMs);
    await tasks.armNext?.();
  });
  sendJson(response, 202, { started: true });
  return true;
}
