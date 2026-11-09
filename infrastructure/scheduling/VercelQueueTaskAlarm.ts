import type { TaskAlarm } from "../../domains/scheduling/application/ports/TaskPorts";

// ---------------------------------------------------------------------------
// Despertadores de la cola de tareas con Vercel Queues (mensajes con retraso).
//
//   VercelQueueTaskAlarm  arma el despertador: un mensaje al tema
//                         `TASK_ALARM_TOPIC` que se entrega a la hora pedida
//   ringTaskWorker        lo que hace el consumidor (`api/task-alarm.ts`) al
//                         recibirlo: despertar al trabajador de PRODUCCIÓN
//
// El mensaje no lleva trabajo: solo «suena». Las tareas siguen en Neon (la
// fuente de verdad) y las ejecuta siempre el despliegue de producción. Así un
// despertador armado por un despliegue viejo (Vercel lo entrega al mismo
// despliegue que lo envió) nunca corre código viejo.
//
// Suena a la hora pedida o un instante antes (nunca después): el programador
// ya pide la hora con margen y la ronda espera la exacta. Varias tareas en el
// mismo tramo de 5 s comparten despertador (clave de idempotencia). Una espera
// de más de 6 días se arma a 6 días: esa ronda arma la siguiente
// (`TaskScheduler.armNext`).
// ---------------------------------------------------------------------------

export const TASK_ALARM_TOPIC = "auream-task-alarms";

/** Lo que Vercel Queues permite: retraso y vida del mensaje hasta 7 días. */
const MAX_RETENTION_S = 604_800;
const MAX_DELAY_S = 6 * 86_400;
/** El mensaje sigue vivo una hora después de sonar: el consumidor puede reintentar. */
const RETRY_WINDOW_S = 3_600;
const BUCKET_MS = 5_000;

export interface AlarmSendOptions {
  readonly delaySeconds: number;
  readonly retentionSeconds: number;
  readonly idempotencyKey: string;
}

/** `send` de `@vercel/queue` (inyectado: las pruebas no hablan con Vercel). */
export type AlarmSend = (topic: string, payload: { readonly at: string }, options: AlarmSendOptions) => Promise<unknown>;

export class VercelQueueTaskAlarm implements TaskAlarm {
  public constructor(
    private readonly send: AlarmSend,
    private readonly onError: (error: unknown) => void = () => undefined,
    private readonly now: () => number = () => Date.now()
  ) {}

  public async ringAt(at: Date): Promise<boolean> {
    const now = this.now();
    // Segundos enteros hacia abajo: suena a la hora pedida o un instante antes.
    const delaySeconds = Math.min(Math.max(0, Math.floor((at.getTime() - now) / 1000)), MAX_DELAY_S);
    const ringsAt = now + delaySeconds * 1000;
    try {
      await this.send(TASK_ALARM_TOPIC, { at: new Date(ringsAt).toISOString() }, {
        delaySeconds,
        retentionSeconds: Math.min(delaySeconds + RETRY_WINDOW_S, MAX_RETENTION_S),
        idempotencyKey: `ring-${Math.floor(ringsAt / BUCKET_MS)}`
      });
      return true;
    } catch (error) {
      this.onError(error);
      return false;
    }
  }
}

/**
 * Despierta al trabajador de producción (`POST /internal/tasks/run` con la
 * clave). Lanza si no responde bien: Vercel Queues reintenta el mensaje.
 */
export async function ringTaskWorker(runUrl: string, secret: string, fetchImpl: typeof fetch = fetch): Promise<void> {
  const response = await fetchImpl(runUrl, { method: "POST", headers: { authorization: `Bearer ${secret}` }, signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`El trabajador respondió ${response.status}.`);
}
