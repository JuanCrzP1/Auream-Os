import { QueueClient } from "@vercel/queue";
import { loadTasksConfig, productionHostOf } from "../apps/api/config/loadTasksConfig";
import { ringTaskWorker, TASK_ALARM_TOPIC } from "../infrastructure/scheduling/VercelQueueTaskAlarm";

// ---------------------------------------------------------------------------
// Consumidor de los despertadores de la cola de tareas (Vercel Queues, tema
// `auream-task-alarms`; disparador en `vercel.json`).
//
// Cuando suena uno, solo despierta al trabajador de PRODUCCIÓN
// (`/internal/tasks/run` con `CRON_SECRET`), que corre lo vencido en Neon. No
// toca la base ni WhatsApp: así un despertador armado por un despliegue viejo
// (Vercel lo entrega al despliegue que lo envió) nunca corre código viejo.
// Si el trabajador no responde, lanza y Vercel Queues reintenta.
// ---------------------------------------------------------------------------

const { handleNodeCallback } = new QueueClient();

export default handleNodeCallback(async (_message, metadata) => {
  if (metadata.topicName !== TASK_ALARM_TOPIC) return;
  const tasks = loadTasksConfig(process.env, productionHostOf(process.env));
  if (!tasks.runUrl || !tasks.cronSecret) {
    // Sin dirección o sin clave no hay a quién despertar: reintentar no lo arregla.
    console.warn(JSON.stringify({ event: "tasks.alarm_unconfigured" }));
    return;
  }
  await ringTaskWorker(tasks.runUrl, tasks.cronSecret);
});
