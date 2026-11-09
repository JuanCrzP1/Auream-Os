import type { QueueClient } from "@vercel/queue";
import { loadTasksConfig, productionHostOf } from "../config/loadTasksConfig";
import { webHandlerOnNode, type NodeHandler } from "../http/webHandlerOnNode";
import { ringTaskWorker, TASK_ALARM_TOPIC } from "../../../infrastructure/scheduling/VercelQueueTaskAlarm";

// ---------------------------------------------------------------------------
// El consumidor de los despertadores de la cola de tareas (Vercel Queues, tema
// `auream-task-alarms`; disparador en `vercel.json`). Lo sirve `api/task-alarm.ts`.
//
// Cuando suena uno, solo despierta al trabajador de PRODUCCIÓN
// (`/internal/tasks/run` con `CRON_SECRET`), que corre lo vencido en Neon. No
// toca la base ni WhatsApp: un despertador armado por un despliegue anterior
// (Vercel lo entrega al despliegue que lo envió) nunca corre código viejo.
//
// Usa el manejador WEB de la librería (`handleCallback`) con
// `webHandlerOnNode`, no `handleNodeCallback`: ese depende de `req.body` y
// `res.status()` de Vercel, que no existen con `NODEJS_HELPERS=0`, y fallaba
// cada entrega sin llamar a nadie.
//
// Si el trabajador no responde bien, el manejador lanza: la librería no
// confirma el aviso y Vercel Queues lo reintenta (`retryAfterSeconds`).
// ---------------------------------------------------------------------------

export function composeTaskAlarmConsumer(
  queue: Pick<QueueClient, "handleCallback">,
  env: NodeJS.ProcessEnv = process.env,
  fetchImpl: typeof fetch = fetch
): NodeHandler {
  return webHandlerOnNode(
    queue.handleCallback(async (message, metadata) => {
      if (metadata.topicName !== TASK_ALARM_TOPIC) return;
      // Cuánto tardó Vercel Queues en entregarlo respecto de la hora pedida (puntualidad medible).
      const ringAt = Date.parse(String((message as { readonly at?: unknown } | null)?.at ?? ""));
      console.info(JSON.stringify({ event: "tasks.alarm_rang", lateMs: Number.isFinite(ringAt) ? Date.now() - ringAt : null, delivery: metadata.deliveryCount }));
      const tasks = loadTasksConfig(env, productionHostOf(env));
      if (!tasks.runUrl || !tasks.cronSecret) {
        // Sin dirección o sin clave no hay a quién despertar: reintentar no lo arregla.
        console.warn(JSON.stringify({ event: "tasks.alarm_unconfigured" }));
        return;
      }
      await ringTaskWorker(tasks.runUrl, tasks.cronSecret, fetchImpl);
    })
  );
}
