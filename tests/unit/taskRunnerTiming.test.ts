import { describe, expect, it, vi } from "vitest";
import { TaskScheduler } from "../../domains/scheduling/application/TaskScheduler.js";
import { TaskRunner } from "../../domains/scheduling/application/TaskRunner.js";
import type { NewTask } from "../../domains/scheduling/domain/ScheduledTask.js";
import { InMemoryTaskRepository } from "../../infrastructure/persistence/memory/InMemoryTaskRepository.js";

// ---------------------------------------------------------------------------
// Puntualidad del trabajador de la cola: toma cada tarea en el milisegundo de
// su hora, y un turno largo de otro chat (pausas de «escribiendo…») no la
// atrasa. Con el trabajador anterior, la segunda tarea arrancaba 12 s tarde.
// ---------------------------------------------------------------------------

const T = "11111111-1111-4111-8111-111111111111";
const START = Date.parse("2026-11-09T12:00:00.000Z");

function harness() {
  const clock = { ms: START };
  const now = () => new Date(clock.ms);
  const repo = new InMemoryTaskRepository();
  let ids = 0;
  const scheduler = new TaskScheduler(repo, { kick: () => undefined }, { now }, () => `id-${++ids}`);
  // Dormir adelanta el reloj: la ronda se prueba sin esperas reales.
  const sleep = async (ms: number) => {
    clock.ms += ms;
  };
  const task = (over: Partial<NewTask> = {}): NewTask => ({ tenantId: T, kind: "demo", groupKey: "g", dedupeKey: `d-${Math.random()}`, payload: {}, dueAt: new Date(clock.ms), ...over });
  return { clock, now, repo, scheduler, sleep, task };
}

describe("TaskRunner: puntualidad", () => {
  it("toma la tarea en el milisegundo de su hora, aunque no caiga en un paso de la espera", async () => {
    const h = harness();
    const handledAt: number[] = [];
    const runner = new TaskRunner(h.repo, [{ kind: "demo", handle: async () => void handledAt.push(h.clock.ms - START) }], { reserveMs: 5_000, pollMs: 2_000 }, { now: h.now }, h.sleep);
    await h.scheduler.schedule(h.task({ dedupeKey: "en-20.1s", dueAt: new Date(START + 20_100) }));
    const report = await runner.run({ budgetMs: 50_000 });
    expect(handledAt).toEqual([20_100]);
    expect(report.maxLateMs).toBe(0);
  });

  it("un turno largo (pausas de «escribiendo…») no atrasa a otra tarea que vence mientras corre", async () => {
    vi.useFakeTimers({ now: START });
    try {
      const repo = new InMemoryTaskRepository();
      const scheduler = new TaskScheduler(repo, { kick: () => undefined });
      const startedAt: Record<string, number> = {};
      const runner = new TaskRunner(repo, [{
        kind: "demo",
        handle: async (task) => {
          startedAt[task.dedupeKey] = Date.now();
          if (task.dedupeKey === "largo") await new Promise((resolve) => setTimeout(resolve, 15_000));
        }
      }], { reserveMs: 5_000, pollMs: 2_000 });
      const at = (dedupeKey: string, inMs: number): NewTask => ({ tenantId: T, kind: "demo", groupKey: dedupeKey, dedupeKey, payload: {}, dueAt: new Date(START + inMs) });
      await scheduler.schedule(at("largo", 0));
      await scheduler.schedule(at("otro", 3_000));

      const round = runner.run({ budgetMs: 50_000 });
      await vi.advanceTimersByTimeAsync(30_000);
      const report = await round;

      expect(startedAt["otro"]! - (START + 3_000)).toBe(0);
      expect(report).toMatchObject({ claimed: 2, completed: 2, maxLateMs: 0 });
    } finally {
      vi.useRealTimers();
    }
  });
});
