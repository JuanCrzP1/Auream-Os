import type { BackgroundTasks } from "../http/BackgroundTasks";
import { TASKS_RUN_PATH } from "../config/loadTasksConfig";

// ---------------------------------------------------------------------------
// Despertar la cola de tareas con el tráfico de la API: la red de seguridad de
// los despertadores de Vercel Queues.
//
//   · Primera petición de cada instancia: asegura quién despierta para la
//     próxima pendiente (`armNext`: ya, o su despertador en ESTE despliegue).
//     Va dentro de una petición porque ahí está la credencial de Vercel Queues.
//     Recupera los despertadores perdidos (un envío fallido, un despliegue anterior).
//   · Después, como mucho cada `everyMs`: si algo vence en segundos o ya
//     venció, despierta al trabajador (`nudgeIfDue`), que espera la hora exacta.
//     Mientras alguien usa la app (el panel abierto pregunta cada pocos
//     segundos, llegan mensajes), lo que vence sigue a su hora aunque se pierda
//     su despertador. Cuesta una consulta liviana por intervalo y por instancia.
//
// Las peticiones del propio trabajador no cuentan: su ronda ya atiende lo que
// vence y, al terminar, arma lo siguiente. Si contaran, cada ronda despertaría
// otra.
// ---------------------------------------------------------------------------

export interface TrafficWakeScheduler {
  armNext(): Promise<void>;
  nudgeIfDue(): Promise<void>;
}

/** Cada cuánto, como mucho, una instancia revisa si algo vence pronto. */
export const TRAFFIC_NUDGE_EVERY_MS = 10_000;

/** Devuelve lo que se llama con la URL de cada petición (antes de atenderla). */
export function wakeTasksOnTraffic(
  scheduler: TrafficWakeScheduler,
  background: Pick<BackgroundTasks, "run">,
  everyMs: number = TRAFFIC_NUDGE_EVERY_MS,
  now: () => number = Date.now
): (url: string | undefined) => void {
  let armed = false;
  let lastNudge = 0;
  return (url) => {
    if (isTaskWorkerRequest(url)) return;
    const at = now();
    if (!armed) {
      armed = true;
      lastNudge = at;
      background.run(() => scheduler.armNext());
      return;
    }
    if (at - lastNudge < everyMs) return;
    lastNudge = at;
    background.run(() => scheduler.nudgeIfDue());
  };
}

function isTaskWorkerRequest(url: string | undefined): boolean {
  const path = (url ?? "").split("?")[0] ?? "";
  return path.endsWith(TASKS_RUN_PATH);
}
