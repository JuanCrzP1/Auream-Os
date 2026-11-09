import { describe, expect, it, vi } from "vitest";
import type { FlowSnapshot } from "../../contracts/FlowSnapshot.js";
import type { InboundChannelMessage } from "../../contracts/InboundMessageContracts.js";
import type { OutboundMessage } from "../../contracts/RuntimeContracts.js";
import { HandleInboundMessageService, conversationKeyFor } from "../../domains/messaging/application/HandleInboundMessageService.js";
import { ConnectionTriggerRouter, DirectoryInboundContacts, SessionLiveSessions } from "../../domains/messaging/application/adapters.js";
import { ConnectionTriggerServices } from "../../domains/connections/application/ConnectionTriggerServices.js";
import { CreateConnectionService } from "../../domains/connections/application/ConnectionServices.js";
import { SessionService } from "../../domains/sessions/application/SessionService.js";
import { ContextService } from "../../domains/sessions/application/ContextService.js";
import { AnalyticsService } from "../../domains/analytics/application/AnalyticsService.js";
import { ExecutionOrchestrator } from "../../flow-engine/execution/ExecutionOrchestrator.js";
import { ExecutionLoop } from "../../flow-engine/execution/ExecutionLoop.js";
import { ExecutionEventTracker } from "../../flow-engine/execution/ExecutionEventTracker.js";
import { EdgeEvaluator } from "../../flow-engine/edges/EdgeEvaluator.js";
import { composeNodeRuntime, simulationDependencies } from "../../apps/api/composition/composeNodeRuntime.js";
import { DefaultTimezoneTenantResolver } from "../../platform/tenancy/application/TenantResolver.js";
import { InMemoryFlowRegistry } from "../../infrastructure/persistence/memory/InMemoryFlowRegistry.js";
import { InMemorySessionRepository } from "../../infrastructure/persistence/memory/InMemorySessionRepository.js";
import { InMemoryConnectionRepository } from "../../infrastructure/persistence/memory/InMemoryConnectionRepository.js";
import { InMemoryConnectionTriggerRepository, InMemoryFlowCatalog } from "../../infrastructure/persistence/memory/InMemoryConnectionTriggerRepository.js";
import { InMemoryConversationLock, InMemoryInboundMessageLog } from "../../infrastructure/persistence/memory/InMemoryMessaging.js";
import type { OutboundDelivery } from "../../domains/messaging/application/ports/MessagingPorts.js";

// ---------------------------------------------------------------------------
// Mensajería entrante de punta a punta con el motor REAL (en memoria): un
// cliente escribe «hola» → el disparador inicia el flujo → recibe el saludo
// y la pregunta → contesta → el flujo CONTINÚA donde estaba (sin volver a
// mirar disparadores) → al terminar, un mensaje nuevo empieza de nuevo.
// Además: duplicados, sin disparador y un fallo que no tumba nada.
// ---------------------------------------------------------------------------

const T = "11111111-1111-4111-8111-111111111111";
const FLOW_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const node = (id: string, type: string, config: Record<string, unknown> = {}) => ({
  id, tenantId: T, flowVersionId: "v1", type, name: id, content: {}, config, metadata: {}
});
const edge = (from: string, to: string, fromOutput?: string) => ({
  id: `${from}->${to}`, tenantId: T, flowVersionId: "v1", fromNodeId: from, toNodeId: to, priority: 10, isFallback: false, condition: { operator: "always" as const }, ...(fromOutput ? { fromOutput } : {})
});

const FLOW: FlowSnapshot = {
  flow: { id: FLOW_ID, tenantId: T, key: FLOW_ID, name: "Ventas", currentPublishedVersionId: "v1" },
  version: { id: "v1", tenantId: T, flowId: FLOW_ID, versionNumber: 1, status: "published", entryNodeId: "start" },
  nodes: {
    start: node("start", "start"),
    hola: node("hola", "message", { items: [{ id: "t", kind: "text", text: "¡Hola {first_name|amigo}! ¿Qué producto buscas?" }] }),
    pregunta: node("pregunta", "question", { targetKey: "producto", waitIndefinitely: true, reaction: "" }),
    gracias: node("gracias", "message", { items: [{ id: "t", kind: "text", text: "Perfecto, te envío info de {producto}." }, { id: "p", kind: "interval", amount: 1, unit: "seconds" }, { id: "i", kind: "image", url: "https://blob.example/catalogo.jpg", caption: "Catálogo", sendOnce: false }] })
  },
  edgesBySource: { start: [edge("start", "hola")], hola: [edge("hola", "pregunta")], pregunta: [edge("pregunta", "gracias", "respuesta")] }
} as unknown as FlowSnapshot;

async function setup() {
  const sessionsRepo = new InMemorySessionRepository();
  const sessions = new SessionService(sessionsRepo);
  const registry = new InMemoryFlowRegistry();
  await registry.publish(FLOW);
  const deps = simulationDependencies();
  const engine = new ExecutionOrchestrator(
    new DefaultTimezoneTenantResolver("America/Bogota"),
    registry,
    sessions,
    new ExecutionLoop(sessions, new ContextService(), composeNodeRuntime(deps), new EdgeEvaluator(), new ExecutionEventTracker(new AnalyticsService()))
  );

  const connections = new InMemoryConnectionRepository();
  const connection = await new CreateConnectionService(connections).execute(T, { name: "Ventas CO", method: "qr" });
  const flows = new InMemoryFlowCatalog([{ tenantId: T, id: FLOW_ID, name: "Ventas", archived: false }]);
  const triggers = new ConnectionTriggerServices(connections, new InMemoryConnectionTriggerRepository(), flows);
  await triggers.create(T, connection.id, { type: "keyword", keywords: ["hola"], automationId: FLOW_ID });

  const sent: Array<{ phone: string; messages: ReadonlyArray<OutboundMessage> }> = [];
  const delivery: OutboundDelivery = {
    deliver: vi.fn(async (_t: string, _c: string, phone: string, messages: ReadonlyArray<OutboundMessage>) => {
      sent.push({ phone, messages });
      return { sent: messages.filter((m) => m.kind !== "pause").length, failures: [] };
    })
  };
  const log = new InMemoryInboundMessageLog();
  const service = new HandleInboundMessageService(
    log,
    new InMemoryConversationLock(),
    new DirectoryInboundContacts(deps.contacts as never),
    new SessionLiveSessions(sessionsRepo, flows),
    new ConnectionTriggerRouter(triggers),
    engine,
    delivery
  );
  let n = 0;
  const message = (text: string, over: Partial<InboundChannelMessage> = {}): InboundChannelMessage => ({
    connectionId: connection.id, providerMessageId: `m${++n}`, phone: "573001112233", senderName: "Laura Gómez", kind: "text",
    text, replyId: null, media: null, fromAd: false, providerType: "Conversation", sentAt: "2026-11-09T12:00:00.000Z", ...over
  });
  return { service, sent, log, message, sessionsRepo, connectionId: connection.id, delivery };
}

describe("HandleInboundMessageService", () => {
  it("«hola» inicia el flujo por su disparador: saluda con el nombre de WhatsApp y pregunta", async () => {
    const s = await setup();
    const result = await s.service.execute(T, s.message("Hola!"));
    expect(result).toMatchObject({ outcome: "flow_started", flowKey: FLOW_ID, sent: 1 });
    expect(s.sent[0]!.phone).toBe("573001112233");
    expect(s.sent[0]!.messages.map((m) => m.content)).toEqual(["¡Hola Laura! ¿Qué producto buscas?"]);
  });

  it("la respuesta CONTINÚA el flujo donde estaba (no vuelve a mirar disparadores) y guarda lo que dijo", async () => {
    const s = await setup();
    await s.service.execute(T, s.message("hola"));
    const result = await s.service.execute(T, s.message("tenis"));
    expect(result).toMatchObject({ outcome: "flow_continued" });
    expect(s.sent[1]!.messages.map((m) => [m.kind ?? "text", m.content, m.media?.url ?? null])).toEqual([
      ["text", "Perfecto, te envío info de tenis.", null],
      ["pause", "", null],
      ["media", "Catálogo", "https://blob.example/catalogo.jpg"]
    ]);
    const session = await s.sessionsRepo.find(`${T}:${conversationKeyFor(s.connectionId, "573001112233")}`);
    expect(session).toMatchObject({ status: "completed", context: { producto: "tenis" } });
  });

  it("terminado el flujo, otro «hola» lo empieza de nuevo", async () => {
    const s = await setup();
    await s.service.execute(T, s.message("hola"));
    await s.service.execute(T, s.message("tenis"));
    expect(await s.service.execute(T, s.message("hola otra vez"))).toMatchObject({ outcome: "flow_started" });
  });

  it("sin disparador que coincida no responde y lo deja registrado", async () => {
    const s = await setup();
    expect(await s.service.execute(T, s.message("buenas tardes"))).toMatchObject({ outcome: "no_trigger" });
    expect(s.delivery.deliver).not.toHaveBeenCalled();
    expect([...s.log.entries.values()][0]).toMatchObject({ outcome: "no_trigger" });
  });

  it("el mismo mensaje repetido por el proveedor se procesa una sola vez", async () => {
    const s = await setup();
    const once = s.message("hola", { providerMessageId: "repetido" });
    await s.service.execute(T, once);
    expect(await s.service.execute(T, once)).toEqual({ outcome: "duplicate" });
    expect(s.sent).toHaveLength(1);
  });

  it("dos mensajes a la vez de la misma conversación se procesan en orden", async () => {
    const s = await setup();
    const [first, second] = await Promise.all([s.service.execute(T, s.message("hola")), s.service.execute(T, s.message("tenis"))]);
    expect([first.outcome, second.outcome]).toEqual(["flow_started", "flow_continued"]);
  });

  it("si algo falla, queda «failed» con el motivo y no lanza", async () => {
    const s = await setup();
    (s.delivery.deliver as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("uazapi caído"));
    expect(await s.service.execute(T, s.message("hola"))).toMatchObject({ outcome: "failed", error: "uazapi caído" });
  });

  it("una foto como respuesta guarda su enlace (lo usa el Comprobante)", async () => {
    const s = await setup();
    await s.service.execute(T, s.message("hola"));
    await s.service.execute(T, s.message("", { kind: "image", media: { url: "https://cdn.uazapi/foto.jpg", mimeType: "image/jpeg" }, providerType: "ImageMessage" }));
    const session = await s.sessionsRepo.find(`${T}:${conversationKeyFor(s.connectionId, "573001112233")}`);
    expect(session?.context).toMatchObject({ producto: "https://cdn.uazapi/foto.jpg" });
  });
});
