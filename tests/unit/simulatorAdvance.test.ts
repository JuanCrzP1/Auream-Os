import { afterEach, describe, expect, it } from "vitest";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { TaskScheduler } from "../../domains/scheduling/application/TaskScheduler.js";
import type { NewTask } from "../../domains/scheduling/domain/ScheduledTask.js";
import { InMemoryTaskRepository } from "../../infrastructure/persistence/memory/InMemoryTaskRepository.js";
import { composeSimulatorTools } from "../../apps/api/composition/composeSimulatorTools.js";
import { routeSimulatorTools, SIMULATOR_ADVANCE_PATH } from "../../apps/api/routes/routeSimulatorTools.js";
import { conversationKeyFor } from "../../domains/messaging/application/HandleInboundMessageService.js";
import { flowTimerGroup } from "../../domains/messaging/application/FlowTimerService.js";

// ---------------------------------------------------------------------------
// «Adelantar el tiempo» (solo con el WhatsApp simulado): lo que el flujo de UN
// chat esperaba vence ya y el trabajador lo corre. Lo autoriza el token del
// número; sin simulador la ruta no existe.
// ---------------------------------------------------------------------------

const T = "11111111-1111-4111-8111-111111111111";
const CONNECTION = "22222222-2222-4222-8222-222222222222";
const NOW = Date.parse("2026-11-12T06:00:00.000Z");

function harness() {
  const repo = new InMemoryTaskRepository();
  const kicks = { count: 0 };
  let ids = 0;
  const scheduler = new TaskScheduler(repo, { kick: () => (kicks.count += 1) }, { now: () => new Date(NOW) }, () => `id-${++ids}`, { kickHorizonMs: 0 });
  const timer = (phone: string, minutes: number): NewTask => ({
    tenantId: T,
    kind: "flow.timer",
    groupKey: flowTimerGroup(conversationKeyFor(CONNECTION, phone)),
    dedupeKey: `t-${phone}-${minutes}`,
    payload: {},
    dueAt: new Date(NOW + minutes * 60_000)
  });
  const channel = { authenticate: async (id: string, token: string) => (id === CONNECTION && token === "tok" ? ({ tenantId: T } as never) : null) };
  return { repo, kicks, scheduler, timer, channel };
}

let server: Server | null = null;
afterEach(() => new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve())));

async function post(tools: ReturnType<typeof composeSimulatorTools>, body: unknown) {
  server = createServer((request, response) => {
    void routeSimulatorTools(request, response, new URL(request.url ?? "/", "http://local"), tools).then((handled) => {
      if (!handled) response.writeHead(404).end();
    });
  });
  await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
  const response = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}${SIMULATOR_ADVANCE_PATH}`, { method: "POST", body: JSON.stringify(body) });
  return { status: response.status, body: (await response.json().catch(() => null)) as { advanced?: string[] } | null };
}

describe("adelantar el tiempo de un chat", () => {
  it("lo pendiente de ESE chat vence ya y despierta al trabajador; los demás chats siguen igual", async () => {
    const h = harness();
    await h.scheduler.schedule(h.timer("584121112233", 30));
    await h.scheduler.schedule(h.timer("573000000000", 30));
    h.kicks.count = 0;

    const tools = composeSimulatorTools({ whatsappSimulator: true }, h.channel, h.scheduler)!;
    const answer = await post(tools, { connectionId: CONNECTION, token: "tok", phone: "+58 412 111 2233" });

    expect(answer).toEqual({ status: 200, body: { advanced: ["2026-11-12T06:30:00.000Z"] } });
    const due = [...h.repo.tasks.values()].map((task) => [task.dedupeKey, task.dueAt]);
    expect(due).toEqual([
      ["t-584121112233-30", "2026-11-12T06:00:00.000Z"],
      ["t-573000000000-30", "2026-11-12T06:30:00.000Z"]
    ]);
    expect(h.kicks.count).toBe(1);
  });

  it("sin nada pendiente responde vacío y no despierta a nadie", async () => {
    const h = harness();
    const tools = composeSimulatorTools({ whatsappSimulator: true }, h.channel, h.scheduler)!;
    expect(await post(tools, { connectionId: CONNECTION, token: "tok", phone: "584121112233" })).toEqual({ status: 200, body: { advanced: [] } });
    expect(h.kicks.count).toBe(0);
  });

  it("exige el token del número, y sin simulador la ruta no existe", async () => {
    const h = harness();
    await h.scheduler.schedule(h.timer("584121112233", 30));
    const tools = composeSimulatorTools({ whatsappSimulator: true }, h.channel, h.scheduler)!;
    expect((await post(tools, { connectionId: CONNECTION, token: "otro", phone: "584121112233" })).status).toBe(401);
    expect([...h.repo.tasks.values()][0]!.dueAt).toBe("2026-11-12T06:30:00.000Z");

    expect(composeSimulatorTools({ whatsappSimulator: false }, h.channel, h.scheduler)).toBeUndefined();
    expect((await post(undefined, { connectionId: CONNECTION, token: "tok", phone: "584121112233" })).status).toBe(404);
  });
});
