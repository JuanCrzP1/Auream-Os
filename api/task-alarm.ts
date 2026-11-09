import { QueueClient } from "@vercel/queue";
import { composeTaskAlarmConsumer } from "../apps/api/bootstrap/composeTaskAlarmConsumer";

// ---------------------------------------------------------------------------
// Función de Vercel: el consumidor de los despertadores de la cola de tareas
// (Vercel Queues, tema `auream-task-alarms`; disparador en `vercel.json`).
// Qué hace y por qué así: `composeTaskAlarmConsumer`.
// ---------------------------------------------------------------------------

export default composeTaskAlarmConsumer(new QueueClient());
