import { describe, expect, it } from "vitest";
import { TaskScheduler } from "../../domains/scheduling/application/TaskScheduler.js";
import { InMemoryTaskRepository } from "../../infrastructure/persistence/memory/InMemoryTaskRepository.js";
import { TRAFFIC_NUDGE_EVERY_MS, wakeTasksOnTraffic } from "../../apps/api/bootstrap/wakeTasksOnTraffic.js";

// ---------------------------------------------------------------------------
// Red de seguridad de los despertadores: si un despertador de Vercel Queues se
// pierde, lo que vence mientras alguien usa la app (el panel abierto pregunta
// cada pocos segundos, llegan mensajes) sigue a su hora igual: el tráfico
// revisa si algo vence en segundos y despierta al trabajador, que espera la
// hora exacta.
// ---------------------------------------------------------------------------

const T = "11111111-1111-4111-8111-111111111111";
const START = Date.parse("2026-11-09T21:14:00.000Z");

describe("nudgeIfDue", () => {
  async function kicksFor(dueInMs: number): Promise<number> {
    const repo = new InMemoryTaskRepository();
    let kicks = 0;
    const scheduler = new TaskScheduler(repo, { kick: () => void (kicks += 1) }, { now: () => new Date(START) }, () => "id", {
      alarm: { ringAt: async () => true }
    });
    await repo.enqueue("t", { tenantId: T, kind: "flow.timer", groupKey: "g", dedupeKey: "d", payload: {}, dueAt: new Date(START + dueInMs) });
    await scheduler.nudgeIfDue();
    return kicks;
  }

  it("despierta al trabajador si algo ya venció o vence en segundos (la ronda espera la hora exacta); lo lejano queda para su despertador", async () => {
    expect(await kicksFor(-60_000)).toBe(1);
    expect(await kicksFor(15_000)).toBe(1);
    expect(await kicksFor(5 * 60_000)).toBe(0);
  });

  it("sin pendientes no despierta a nadie", async () => {
    let kicks = 0;
    const scheduler = new TaskScheduler(new InMemoryTaskRepository(), { kick: () => void (kicks += 1) });
    await scheduler.nudgeIfDue();
    expect(kicks).toBe(0);
  });
});

describe("wakeTasksOnTraffic", () => {
  function harness() {
    const clock = { ms: START };
    const calls: string[] = [];
    const pending: Promise<unknown>[] = [];
    const wake = wakeTasksOnTraffic(
      { armNext: async () => void calls.push("arm"), nudgeIfDue: async () => void calls.push("nudge") },
      { run: (work) => void pending.push(work()) },
      TRAFFIC_NUDGE_EVERY_MS,
      () => clock.ms
    );
    return { clock, calls, wake, settle: () => Promise.all(pending) };
  }

  it("la primera petición de la instancia arma lo siguiente; después revisa como mucho cada 10 s", async () => {
    const h = harness();
    h.wake("/conversations");
    h.clock.ms += 4_000;
    h.wake("/conversations/abc/live");
    h.clock.ms += 6_000;
    h.wake("/conversations");
    h.clock.ms += 4_000;
    h.wake("/automations");
    h.clock.ms += 6_000;
    h.wake("/conversations");
    await h.settle();
    expect(h.calls).toEqual(["arm", "nudge", "nudge"]);
  });

  it("las peticiones del propio trabajador no cuentan (si no, cada ronda despertaría otra)", async () => {
    const h = harness();
    h.wake("/internal/tasks/run");
    h.wake("/api/internal/tasks/run?source=alarm");
    await h.settle();
    expect(h.calls).toEqual([]);
    h.wake("/webhooks/whatsapp/uazapi");
    await h.settle();
    expect(h.calls).toEqual(["arm"]);
  });
});
