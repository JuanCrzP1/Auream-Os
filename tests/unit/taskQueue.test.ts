import { describe, expect, it, vi } from "vitest";
import { TaskScheduler } from "../../domains/scheduling/application/TaskScheduler.js";
import { TaskRunner } from "../../domains/scheduling/application/TaskRunner.js";
import { PermanentTaskError, retryDelayMs, type NewTask, type ScheduledTask } from "../../domains/scheduling/domain/ScheduledTask.js";
import { InMemoryTaskRepository } from "../../infrastructure/persistence/memory/InMemoryTaskRepository.js";
import { HttpTaskKicker, InProcessTaskKicker } from "../../infrastructure/scheduling/TaskKickers.js";

// ---------------------------------------------------------------------------
// La cola de tareas (FASE C6), genérica: programar sin duplicados, una
// pendiente por grupo, despertar al trabajador si vence pronto, y el
// trabajador con reintentos espaciados, errores definitivos, tiempo de ronda
// limitado y espera de las tareas que vencen dentro de la ronda.
// ---------------------------------------------------------------------------

const T = "11111111-1111-4111-8111-111111111111";
const START = Date.parse("2026-11-09T12:00:00.000Z");

function harness() {
  const clock = { ms: START };
  const now = () => new Date(clock.ms);
  const repo = new InMemoryTaskRepository();
  const kicks = { count: 0 };
  let ids = 0;
  const scheduler = new TaskScheduler(repo, { kick: () => (kicks.count += 1) }, { now }, () => `id-${++ids}`);
  // Dormir adelanta el reloj: la ronda se prueba sin esperas reales.
  const sleep = async (ms: number) => {
    clock.ms += ms;
  };
  const task = (over: Partial<NewTask> = {}): NewTask => ({ tenantId: T, kind: "demo", groupKey: "g", dedupeKey: `d-${Math.random()}`, payload: {}, dueAt: new Date(clock.ms), ...over });
  return { clock, now, repo, kicks, scheduler, sleep, task };
}

describe("TaskScheduler", () => {
  it("no duplica (misma clave), deja una pendiente por grupo y despierta al trabajador solo si vence pronto", async () => {
    const h = harness();
    expect(await h.scheduler.schedule(h.task({ dedupeKey: "a" }))).toBe(true);
    expect(await h.scheduler.schedule(h.task({ dedupeKey: "a" }))).toBe(false);
    expect(h.kicks.count).toBe(1);

    await h.scheduler.schedule(h.task({ dedupeKey: "lejos", groupKey: "otro", dueAt: new Date(START + 10 * 60_000) }));
    expect(h.kicks.count).toBe(1);

    await h.scheduler.replaceInGroup(h.task({ dedupeKey: "b" }));
    const byKey = (key: string) => [...h.repo.tasks.values()].find((task) => task.dedupeKey === key)!.status;
    expect([byKey("a"), byKey("b"), byKey("lejos")]).toEqual(["cancelled", "pending", "pending"]);
  });
});

describe("TaskRunner", () => {
  it("ejecuta las vencidas; un error reintenta más tarde (espaciado) y al agotar intentos queda fallida", async () => {
    const h = harness();
    const handle = vi.fn(async (task: ScheduledTask) => {
      if (task.payload["ok"] !== true) throw new Error("uazapi caído");
    });
    const runner = new TaskRunner(h.repo, [{ kind: "demo", handle }], { reserveMs: 0 }, { now: h.now }, h.sleep);
    await h.scheduler.schedule(h.task({ dedupeKey: "ok", payload: { ok: true } }));
    await h.scheduler.schedule(h.task({ dedupeKey: "mal", maxAttempts: 2 }));

    expect(await runner.run({ budgetMs: 60_000, waitForUpcoming: false })).toMatchObject({ claimed: 2, completed: 1, retried: 1, maxLateMs: 0 });
    const failing = [...h.repo.tasks.values()].find((task) => task.dedupeKey === "mal")!;
    expect(failing).toMatchObject({ status: "pending", attempts: 1, lastError: "uazapi caído", dueAt: new Date(START + retryDelayMs(1)).toISOString() });

    h.clock.ms += retryDelayMs(1);
    expect(await runner.run({ budgetMs: 60_000, waitForUpcoming: false })).toMatchObject({ failed: 1 });
    expect([...h.repo.tasks.values()].find((task) => task.dedupeKey === "mal")).toMatchObject({ status: "failed", attempts: 2 });
  });

  it("un error definitivo o un tipo sin manejador no se reintenta", async () => {
    const h = harness();
    const runner = new TaskRunner(h.repo, [{ kind: "demo", handle: async () => { throw new PermanentTaskError("datos rotos"); } }], { reserveMs: 0 }, { now: h.now }, h.sleep);
    await h.scheduler.schedule(h.task({ dedupeKey: "a" }));
    await h.scheduler.schedule(h.task({ dedupeKey: "b", kind: "desconocido" }));
    expect(await runner.run({ budgetMs: 60_000, waitForUpcoming: false })).toMatchObject({ failed: 2, retried: 0 });
    expect([...h.repo.tasks.values()].map((task) => task.lastError).sort()).toEqual(["No hay manejador para «desconocido».", "datos rotos"]);
  });

  it("espera dentro de la ronda lo que vence antes de que termine; lo que vence después queda para otra", async () => {
    const h = harness();
    const handled: string[] = [];
    const runner = new TaskRunner(h.repo, [{ kind: "demo", handle: async (task) => void handled.push(task.dedupeKey) }], { reserveMs: 5_000, pollMs: 2_000 }, { now: h.now }, h.sleep);
    await h.scheduler.schedule(h.task({ dedupeKey: "en-20s", dueAt: new Date(START + 20_000) }));
    await h.scheduler.schedule(h.task({ dedupeKey: "en-10min", dueAt: new Date(START + 600_000) }));

    await runner.run({ budgetMs: 50_000 });
    expect(handled).toEqual(["en-20s"]);
    expect(h.clock.ms - START).toBeGreaterThanOrEqual(20_000);
    expect(h.clock.ms - START).toBeLessThan(25_000);
  });

  it("no toma más tareas si no queda tiempo para terminarlas: una ronda corta toma solo su primer lote", async () => {
    const h = harness();
    const slow = async () => {
      h.clock.ms += 15_000;
    };
    await h.scheduler.schedule(h.task({ dedupeKey: "uno" }));
    await h.scheduler.schedule(h.task({ dedupeKey: "dos" }));
    const short = new TaskRunner(h.repo, [{ kind: "demo", handle: slow }], { reserveMs: 25_000, batchSize: 1 }, { now: h.now }, h.sleep);
    expect(await short.run({ budgetMs: 20_000 })).toMatchObject({ claimed: 1 });
  });

  it("una reserva caducada (el proceso murió) se retoma en otra ronda", async () => {
    const h = harness();
    const handle = vi.fn(async () => undefined);
    await h.scheduler.schedule(h.task({ dedupeKey: "a" }));

    // Un proceso la tomó y murió: tras la reserva, otra ronda la retoma.
    await h.repo.claimDue(h.now(), 10, 60_000);
    const runner = new TaskRunner(h.repo, [{ kind: "demo", handle }], { reserveMs: 0 }, { now: h.now }, h.sleep);
    expect(await runner.run({ budgetMs: 60_000, waitForUpcoming: false })).toMatchObject({ claimed: 0 });
    h.clock.ms += 61_000;
    // Corrió 61 s tarde: el informe de la ronda lo dice (el registro avisa `tasks.late`).
    expect(await runner.run({ budgetMs: 60_000, waitForUpcoming: false })).toMatchObject({ claimed: 1, completed: 1, maxLateMs: 61_000 });
  });

  it("borra las terminadas viejas", async () => {
    const h = harness();
    const runner = new TaskRunner(h.repo, [{ kind: "demo", handle: async () => undefined }], { reserveMs: 0, retentionMs: 60_000 }, { now: h.now }, h.sleep);
    await h.scheduler.schedule(h.task({ dedupeKey: "a" }));
    await runner.run({ budgetMs: 60_000, waitForUpcoming: false });
    h.clock.ms += 120_000;
    expect(await runner.run({ budgetMs: 60_000, waitForUpcoming: false })).toMatchObject({ purged: 1 });
  });
});

describe("cadena de rondas (plan sin cron frecuente)", () => {
  it("si algo vence dentro del margen, una sola ronda por tramo despierta la siguiente; si no, la cadena se detiene", async () => {
    const h = harness();
    expect(await h.scheduler.continueIfSoon(900_000)).toBe(false);
    await h.scheduler.schedule(h.task({ dedupeKey: "programador", dueAt: new Date(START + 3 * 60_000) }));
    const before = h.kicks.count;
    expect(await h.scheduler.continueIfSoon(900_000)).toBe(true);
    // Otra ronda que termina en el mismo tramo no abre una segunda cadena.
    expect(await h.scheduler.continueIfSoon(900_000)).toBe(false);
    expect(h.kicks.count).toBe(before + 1);
    h.clock.ms += 30_000;
    expect(await h.scheduler.continueIfSoon(900_000)).toBe(true);
    // Lejos del margen, o con la cadena apagada: no sigue.
    expect(await h.scheduler.continueIfSoon(60_000)).toBe(false);
    expect(await h.scheduler.continueIfSoon(0)).toBe(false);
  });

  it("la ronda se sostiene hasta el final si algo vence dentro del margen, y el eslabón se completa sin trabajo", async () => {
    const h = harness();
    const handled: string[] = [];
    const runner = new TaskRunner(h.repo, [{ kind: "demo", handle: async (task) => void handled.push(task.dedupeKey) }], { reserveMs: 5_000, pollMs: 2_000 }, { now: h.now }, h.sleep);
    await h.scheduler.schedule(h.task({ dedupeKey: "en-3min", dueAt: new Date(START + 180_000) }));
    await h.scheduler.continueIfSoon(900_000);

    const report = await runner.run({ budgetMs: 50_000, holdWithinMs: 900_000 });
    expect(handled).toEqual([]);
    expect(report.completed).toBe(1); // el eslabón
    expect(h.clock.ms - START).toBeGreaterThanOrEqual(45_000);
    // Sin sostener, la ronda termina enseguida.
    const quick = harness();
    await quick.scheduler.schedule(quick.task({ dueAt: new Date(START + 180_000) }));
    await new TaskRunner(quick.repo, [], { reserveMs: 5_000 }, { now: quick.now }, quick.sleep).run({ budgetMs: 50_000 });
    expect(quick.clock.ms).toBe(START);
  });
});

describe("despertar al trabajador", () => {
  it("por HTTP con la clave, agrupando avisos seguidos", async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 202 }));
    const work: Array<() => Promise<unknown>> = [];
    const kicker = new HttpTaskKicker("https://app.test/api/internal/tasks/run", "s".repeat(32), (job) => void work.push(job), 3_000, fetchImpl as unknown as typeof fetch);
    kicker.kick();
    kicker.kick();
    await Promise.all(work.map((job) => job()));
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0]![1]).toMatchObject({ method: "POST", headers: { authorization: `Bearer ${"s".repeat(32)}` } });
  });

  it("en el proceso: una ronda a la vez; un aviso durante la ronda pide otra al terminar", async () => {
    let rounds = 0;
    let release: () => void = () => undefined;
    const pending: Array<Promise<unknown>> = [];
    const kicker = new InProcessTaskKicker(
      () => new Promise<void>((resolve) => { rounds += 1; release = resolve; }),
      (job) => void pending.push(job())
    );
    kicker.kick();
    kicker.kick();
    expect(rounds).toBe(1);
    release();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(rounds).toBe(2);
    release();
    await Promise.all(pending);
  });
});
