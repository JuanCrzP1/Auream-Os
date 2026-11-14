import { describe, expect, it, vi } from "vitest";
import type { FlowRunResult } from "../../contracts/FlowTimerContracts.js";
import type { FlowSnapshot } from "../../contracts/FlowSnapshot.js";
import type { InboundEnvelope } from "../../contracts/RuntimeContracts.js";
import { ExecutionLoop } from "../../flow-engine/execution/ExecutionLoop.js";
import { EdgeEvaluator } from "../../flow-engine/edges/EdgeEvaluator.js";
import { ExecutionEventTracker } from "../../flow-engine/execution/ExecutionEventTracker.js";
import { NodeRuntime } from "../../flow-engine/nodes/NodeRuntime.js";
import { MessageNodeHandler } from "../../flow-engine/nodes/message/MessageNodeHandler.js";
import { GoToFlowNodeHandler } from "../../flow-engine/nodes/go-to-flow/GoToFlowNodeHandler.js";
import { SessionService } from "../../domains/sessions/application/SessionService.js";
import { ContextService } from "../../domains/sessions/application/ContextService.js";
import { AnalyticsService } from "../../domains/analytics/application/AnalyticsService.js";
import { FlowTurn } from "../../domains/messaging/application/FlowTurn.js";
import type { FlowTurnRecord } from "../../domains/messaging/application/FlowTurnJournal.js";
import type { DeliveryReport, FlowRunner } from "../../domains/messaging/application/ports/MessagingPorts.js";
import { InMemorySessionRepository } from "../../infrastructure/persistence/memory/InMemorySessionRepository.js";
import { InMemoryFlowCatalog } from "../../infrastructure/persistence/memory/InMemoryConnectionTriggerRepository.js";
import { makeSession, makeEnvelope } from "./helpers/executionHarness.js";
import { validLeadCaptureFlow } from "../fixtures/flows/validLeadCaptureFlow.js";

// ---------------------------------------------------------------------------
// «Ir a otro flujo» de punta a punta: el motor termina el flujo y devuelve el
// salto con los datos guardados; el turno arranca el otro flujo AHORA (lo que
// envían los dos sale en el mismo turno) y el otro flujo empieza con esos
// datos. Protecciones: flujo activo de la cuenta, no el mismo, hasta 5 saltos.
// ---------------------------------------------------------------------------

const loop = () =>
  new ExecutionLoop(
    new SessionService(new InMemorySessionRepository()),
    new ContextService(),
    new NodeRuntime([new MessageNodeHandler(), new GoToFlowNodeHandler()]),
    new EdgeEvaluator(),
    new ExecutionEventTracker(new AnalyticsService())
  );

const node = (id: string, type: "message" | "go-to-flow", config: Record<string, unknown>) => ({ id, tenantId: "tenant-test", flowVersionId: "v1", type, name: id, content: {}, config, metadata: {} });
const snapshot = (nodes: ReturnType<typeof node>[], edges: Record<string, string>): FlowSnapshot =>
  ({
    ...validLeadCaptureFlow,
    nodes: Object.fromEntries(nodes.map((item) => [item.id, item])),
    edgesBySource: Object.fromEntries(
      Object.entries(edges).map(([from, to]) => [from, [{ id: `${from}-${to}`, fromNodeId: from, toNodeId: to, priority: 10, isFallback: false, condition: { operator: "always" } }]])
    )
  }) as unknown as FlowSnapshot;

describe("el motor", () => {
  it("«Ir a otro flujo» termina el flujo y devuelve el salto con los datos, sin los internos", async () => {
    const flow = snapshot([node("hola", "message", { items: [{ id: "t", kind: "text", text: "Te paso" }] }), node("saltar", "go-to-flow", { flowId: "f2", flowName: "Promoción" })], { hola: "saltar" });
    const session = makeSession({ currentNodeId: "hola", context: { cancion_1: "https://x/c1.mp3", __wake: { at: "x" } } });
    const result = await loop().run(flow, session, makeEnvelope());
    expect(result.executionStatus).toBe("completed");
    expect(result.outputMessages.map((message) => message.content)).toEqual(["Te paso"]);
    expect(result.handoff).toEqual({ flowId: "f2", flowName: "Promoción", context: { cancion_1: "https://x/c1.mp3" } });
  });

  it("el flujo de destino empieza con los datos que trae el salto", async () => {
    const flow = snapshot([node("inicio", "message", { items: [{ id: "t", kind: "text", text: "Tu canción: {cancion_1}" }] })], {});
    const envelope: InboundEnvelope = { ...makeEnvelope(""), payload: { text: "", handoff: true, handoffDepth: 1, carriedContext: { cancion_1: "https://x/c1.mp3", __retry: 2 } } };
    const result = await loop().run(flow, makeSession({ currentNodeId: "inicio" }), envelope);
    expect(result.outputMessages.map((message) => message.content)).toEqual(["Tu canción: https://x/c1.mp3"]);
  });
});

describe("el turno", () => {
  const target = { tenantId: "t", connectionId: "c", phone: "573000000000", conversationKey: "k", flowKey: "venta", conversationId: "x" };
  const envelope = { tenantId: "t", flowKey: "venta", channel: "whatsapp", conversationKey: "k", userKey: "573000000000", messageId: "m", payload: { text: "hola" }, receivedAt: "2026-11-14T12:00:00.000Z" } as InboundEnvelope;
  const done = (events: string[], handoff?: FlowRunResult["handoff"]): FlowRunResult => ({ executionStatus: "completed", outputMessages: [], contextPatch: {}, nodeResult: {}, domainEvents: events, ...(handoff ? { handoff } : {}) });
  const flows = new InMemoryFlowCatalog([
    { id: "f2", key: "promo", name: "Promoción", archived: false, tenantId: "t" },
    { id: "f3", key: "vieja", name: "Vieja", archived: true, tenantId: "t" },
    { id: "f4", key: "pausada", name: "Pausada", archived: false, paused: true, tenantId: "t" },
    { id: "f1", key: "venta", name: "Venta", archived: false, tenantId: "t" }
  ]);

  function setup(results: FlowRunResult[]) {
    const envelopes: InboundEnvelope[] = [];
    const runner: FlowRunner = { handle: vi.fn(async (next: InboundEnvelope) => (envelopes.push(next), results[Math.min(envelopes.length - 1, results.length - 1)]!)) };
    const delivery = { deliver: vi.fn(async (): Promise<DeliveryReport> => ({ sent: 1, failures: [], results: [] })) };
    const journal: FlowTurnRecord[] = [];
    const turn = new FlowTurn(runner, delivery, { recordOutbound: vi.fn(async () => undefined) }, { afterTurn: vi.fn(async () => undefined) }, () => new Date("2026-11-14T12:00:00.000Z"), { record: async (entry) => void journal.push(entry) }, undefined, flows);
    return { turn, envelopes, delivery, journal };
  }

  it("arranca el otro flujo en el mismo turno, con los datos; lo que envían los dos cuenta junto", async () => {
    const { turn, envelopes, journal } = setup([done(["go_to_flow:n:Promoción"], { flowId: "f2", flowName: "Promoción", context: { cancion_1: "u" } }), done(["promo_message"])]);
    const outcome = await turn.run(target, envelope);
    expect(envelopes.map((item) => item.flowKey)).toEqual(["venta", "promo"]);
    expect(envelopes[1]!.payload).toEqual({ text: "", handoff: true, handoffDepth: 1, carriedContext: { cancion_1: "u" } });
    expect(outcome.report.sent).toBe(2);
    expect(outcome.result.domainEvents).toEqual(["go_to_flow:n:Promoción", "promo_message"]);
    expect(journal.map((entry) => [entry.flowKey, entry.origin])).toEqual([["venta", "message"], ["promo", "handoff"]]);
  });

  it.each([
    ["f3", "archived"],
    ["f4", "paused"],
    ["f1", "same_flow"],
    ["no-existe", "missing"]
  ])("no salta a %s (%s): el flujo de origen ya terminó y queda anotado", async (flowId, reason) => {
    const { turn, envelopes } = setup([done([], { flowId, flowName: "X", context: {} })]);
    const outcome = await turn.run(target, envelope);
    expect(envelopes).toHaveLength(1);
    expect(outcome.result.domainEvents).toEqual([`go_to_flow_refused:${reason}:X`]);
  });

  it("dos flujos que se pasan el cliente sin parar se cortan a los 5 saltos", async () => {
    const toPromo = done([], { flowId: "f2", flowName: "Promoción", context: {} });
    const toVenta = done([], { flowId: "f1", flowName: "Venta", context: {} });
    const { turn, envelopes } = setup([toPromo, toVenta, toPromo, toVenta, toPromo, toVenta, toPromo]);
    const outcome = await turn.run({ ...target, flowKey: "otro" }, { ...envelope, flowKey: "otro" });
    // El primero + 5 saltos; el sexto se niega.
    expect(envelopes.map((item) => item.flowKey)).toEqual(["otro", "promo", "venta", "promo", "venta", "promo"]);
    expect(outcome.result.domainEvents.at(-1)).toBe("go_to_flow_refused:chain_limit:Venta");
  });
});
