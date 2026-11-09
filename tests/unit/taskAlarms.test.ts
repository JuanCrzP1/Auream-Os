import { describe, expect, it, vi } from "vitest";
import { TaskScheduler } from "../../domains/scheduling/application/TaskScheduler.js";
import type { NewTask } from "../../domains/scheduling/domain/ScheduledTask.js";
import { InMemoryTaskRepository } from "../../infrastructure/persistence/memory/InMemoryTaskRepository.js";
import { ringTaskWorker, TASK_ALARM_TOPIC, VercelQueueTaskAlarm, type AlarmSend } from "../../infrastructure/scheduling/VercelQueueTaskAlarm.js";

// ---------------------------------------------------------------------------
// Despertadores de la cola (plan Hobby de Vercel, sin cron frecuente): lo que
// vence en segundos despierta al trabajador ya; lo que vence más tarde arma un
// mensaje con retraso en Vercel Queues que suena a su hora. Al terminar cada
// ronda se arma el de la siguiente pendiente (reintentos, esperas de semanas).
// ---------------------------------------------------------------------------

const T = "11111111-1111-4111-8111-111111111111";
const START = Date.parse("2026-11-09T12:00:00.000Z");
const MIN = 60_000;

function harness() {
  const clock = { ms: START };
  const repo = new InMemoryTaskRepository();
  const kicks = { count: 0 };
  const rings: Date[] = [];
  let ids = 0;
  const scheduler = new TaskScheduler(repo, { kick: () => (kicks.count += 1) }, { now: () => new Date(clock.ms) }, () => `id-${++ids}`, {
    alarm: { ringAt: async (at) => (rings.push(at), true) }
  });
  const task = (key: string, dueInMs: number): NewTask => ({ tenantId: T, kind: "demo", groupKey: key, dedupeKey: key, payload: {}, dueAt: new Date(clock.ms + dueInMs) });
  return { clock, repo, kicks, rings, scheduler, task };
}

describe("TaskScheduler con despertador", () => {
  it("lo que vence en segundos despierta ya; lo que vence en minutos u horas arma su despertador a esa hora", async () => {
    const h = harness();
    await h.scheduler.schedule(h.task("pausa", 20_000));
    await h.scheduler.schedule(h.task("programador", 3 * MIN));
    await h.scheduler.schedule(h.task("espera", 2 * 60 * MIN));
    // Repetida (misma clave): ni despierta ni arma otro.
    await h.scheduler.schedule(h.task("espera", 2 * 60 * MIN));
    expect(h.kicks.count).toBe(1);
    expect(h.rings.map((at) => at.toISOString())).toEqual(["2026-11-09T12:03:00.000Z", "2026-11-09T14:00:00.000Z"]);
  });

  it("al terminar una ronda arma el despertador de la siguiente pendiente (o despierta ya si vence pronto)", async () => {
    const h = harness();
    await h.repo.enqueue("a", h.task("reintento", 8 * MIN));
    await h.scheduler.armNext();
    expect(h.rings.map((at) => at.toISOString())).toEqual(["2026-11-09T12:08:00.000Z"]);
    await h.repo.enqueue("b", h.task("ya", 10_000));
    await h.scheduler.armNext();
    expect(h.kicks.count).toBe(1);
    // Sin pendientes no hace nada.
    const empty = harness();
    await empty.scheduler.armNext();
    expect([empty.kicks.count, empty.rings.length]).toEqual([0, 0]);
  });
});

describe("VercelQueueTaskAlarm", () => {
  const capture = () => {
    const sent: Array<{ topic: string; payload: { at: string }; options: Parameters<AlarmSend>[2] }> = [];
    const send: AlarmSend = async (topic, payload, options) => void sent.push({ topic, payload, options });
    return { sent, send };
  };

  it("suena un segundo después de la hora, vive una hora más para reintentos y comparte despertador por tramo de 5 s", async () => {
    const { sent, send } = capture();
    const alarm = new VercelQueueTaskAlarm(send, undefined, () => START);
    expect(await alarm.ringAt(new Date(START + 3 * MIN))).toBe(true);
    await alarm.ringAt(new Date(START + 3 * MIN + 2_000));
    expect(sent[0]).toEqual({
      topic: TASK_ALARM_TOPIC,
      payload: { at: "2026-11-09T12:03:01.000Z" },
      options: { delaySeconds: 181, retentionSeconds: 3_781, idempotencyKey: `ring-${Math.floor((START + 181_000) / 5_000)}` }
    });
    expect(sent[1]!.options.idempotencyKey).toBe(sent[0]!.options.idempotencyKey);
  });

  it("una espera de más de 6 días se arma a 6 días (esa ronda arma la siguiente); una hora ya pasada suena enseguida", async () => {
    const { sent, send } = capture();
    const alarm = new VercelQueueTaskAlarm(send, undefined, () => START);
    await alarm.ringAt(new Date(START + 30 * 86_400_000));
    await alarm.ringAt(new Date(START - MIN));
    expect(sent.map((item) => [item.options.delaySeconds, item.options.retentionSeconds])).toEqual([[518_400, 522_000], [1, 3_601]]);
  });

  it("si Vercel Queues falla, avisa y responde `false` sin lanzar", async () => {
    const onError = vi.fn();
    const alarm = new VercelQueueTaskAlarm(async () => { throw new Error("401 OIDC"); }, onError, () => START);
    await expect(alarm.ringAt(new Date(START + MIN))).resolves.toBe(false);
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: "401 OIDC" }));
  });
});

describe("ringTaskWorker (lo que hace el consumidor)", () => {
  it("despierta al trabajador con la clave; si no responde bien, lanza para que la cola reintente", async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 202 }));
    await ringTaskWorker("https://auream-os.vercel.app/api/internal/tasks/run", "s".repeat(32), fetchImpl as unknown as typeof fetch);
    expect(fetchImpl).toHaveBeenCalledWith("https://auream-os.vercel.app/api/internal/tasks/run", expect.objectContaining({ method: "POST", headers: { authorization: `Bearer ${"s".repeat(32)}` } }));
    const failing = vi.fn(async () => new Response(null, { status: 503 }));
    await expect(ringTaskWorker("https://x/api/internal/tasks/run", "s".repeat(32), failing as unknown as typeof fetch)).rejects.toThrow(/503/);
  });
});
