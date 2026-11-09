import { describe, expect, it, vi } from "vitest";
import type { FlowSnapshot } from "../../contracts/FlowSnapshot.js";
import type { InboundChannelMessage } from "../../contracts/InboundMessageContracts.js";
import type { OutboundMessage } from "../../contracts/RuntimeContracts.js";
import { WAKE_CONTEXT_KEY } from "../../contracts/FlowTimerContracts.js";
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
import type { DeliveryResult, OutboundDelivery } from "../../domains/messaging/application/ports/MessagingPorts.js";
import { ConversationInbox, ConversationRecorder } from "../../domains/conversations/application/ConversationServices.js";
import { InMemoryConversationRepository } from "../../infrastructure/persistence/memory/InMemoryConversationRepository.js";
import { StartFlowService } from "../../domains/messaging/application/StartFlowService.js";
import { RepositorySessionControl } from "../../domains/messaging/application/adapters.js";
import { FlowTurn } from "../../domains/messaging/application/FlowTurn.js";
import { FlowTimerService } from "../../domains/messaging/application/FlowTimerService.js";
import { TaskScheduler } from "../../domains/scheduling/application/TaskScheduler.js";
import { TaskRunner } from "../../domains/scheduling/application/TaskRunner.js";
import { InMemoryTaskRepository } from "../../infrastructure/persistence/memory/InMemoryTaskRepository.js";
import { FlowTimerTaskHandler, SchedulerFlowTimers } from "../../apps/api/composition/flowTimerAdapters.js";

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

async function setup(options: { readonly flow?: FlowSnapshot } = {}) {
  // Reloj controlado: los despertadores se prueban adelantando el tiempo.
  const clock = { ms: Date.parse("2026-11-09T12:00:00.000Z") };
  const now = () => new Date(clock.ms);
  const sessionsRepo = new InMemorySessionRepository();
  const sessions = new SessionService(sessionsRepo);
  const registry = new InMemoryFlowRegistry();
  await registry.publish(options.flow ?? FLOW);
  const deps = simulationDependencies();
  const engine = new ExecutionOrchestrator(
    new DefaultTimezoneTenantResolver("America/Bogota"),
    registry,
    sessions,
    new ExecutionLoop(sessions, new ContextService(), composeNodeRuntime(deps), new EdgeEvaluator(), new ExecutionEventTracker(new AnalyticsService()), now)
  );

  const connections = new InMemoryConnectionRepository();
  const connection = await new CreateConnectionService(connections).execute(T, { name: "Ventas CO", method: "qr" });
  const flows = new InMemoryFlowCatalog([{ tenantId: T, id: FLOW_ID, name: "Ventas", archived: false }]);
  const triggers = new ConnectionTriggerServices(connections, new InMemoryConnectionTriggerRepository(), flows);
  await triggers.create(T, connection.id, { type: "keyword", keywords: ["hola"], automationId: FLOW_ID });

  const sent: Array<{ phone: string; messages: ReadonlyArray<OutboundMessage> }> = [];
  const delivery: OutboundDelivery = {
    // Como el canal real: cada mensaje se informa apenas sale (la bandeja en vivo).
    deliver: vi.fn(async (_t: string, _c: string, phone: string, messages: ReadonlyArray<OutboundMessage>, onResult?: (result: DeliveryResult) => Promise<void>) => {
      sent.push({ phone, messages });
      const results = messages.filter((m) => m.kind !== "pause" && m.kind !== "presence").map((message, index) => ({ message, ok: true, providerMessageId: `wa-${sent.length}-${index}` }));
      for (const result of results) await onResult?.(result);
      return { sent: results.length, failures: [], results };
    })
  };
  const log = new InMemoryInboundMessageLog();
  const conversations = new InMemoryConversationRepository();
  const recorder = new ConversationRecorder(conversations);
  const lock = new InMemoryConversationLock();
  // Cola de tareas en memoria con el mismo reloj (despertadores de los flujos).
  const tasks = new InMemoryTaskRepository();
  const scheduler = new TaskScheduler(tasks, { kick: () => undefined }, { now });
  const turn = new FlowTurn(engine, delivery, recorder, new SchedulerFlowTimers(scheduler), now);
  const timers = new FlowTimerService(lock, recorder, turn, now);
  const runner = new TaskRunner(tasks, [new FlowTimerTaskHandler(timers)], { reserveMs: 0 }, { now }, async () => undefined);
  const service = new HandleInboundMessageService(
    log,
    lock,
    new DirectoryInboundContacts(deps.contacts as never),
    new SessionLiveSessions(sessionsRepo, flows),
    new ConnectionTriggerRouter(triggers),
    turn,
    recorder
  );
  // Etiquetar = etiquetar al contacto; aquí el catálogo es fijo y se guarda en el repositorio en memoria.
  const catalog = [{ id: "l-vip", name: "VIP", color: "#f59e0b" }, { id: "l-pago", name: "Pagó", color: "#16a34a" }];
  const labeled: Array<{ contactId: string; labelIds: ReadonlyArray<string> }> = [];
  const labeler = {
    setLabels: async (_tenantId: string, contactId: string, labelIds: ReadonlyArray<string>) => {
      labeled.push({ contactId, labelIds });
      conversations.contactLabels.set(contactId, catalog.filter((label) => labelIds.includes(label.id)));
    }
  };
  const inbox = new ConversationInbox(
    conversations,
    recorder,
    delivery,
    new StartFlowService(flows, lock, new RepositorySessionControl(sessionsRepo), turn, now),
    labeler
  );
  let n = 0;
  const message = (text: string, over: Partial<InboundChannelMessage> = {}): InboundChannelMessage => ({
    connectionId: connection.id, providerMessageId: `m${++n}`, phone: "573001112233", senderName: "Laura Gómez", kind: "text",
    text, replyId: null, media: null, fromAd: false, providerType: "Conversation", sentAt: now().toISOString(), ...over
  });
  /** Adelanta el reloj y corre una ronda del trabajador (sin esperar tareas futuras). */
  const advance = async (ms: number) => {
    clock.ms += ms;
    return runner.run({ budgetMs: 60_000, waitForUpcoming: false });
  };
  const pending = () => [...tasks.tasks.values()].filter((task) => task.status === "pending");
  return { service, sent, log, message, sessionsRepo, connectionId: connection.id, delivery, conversations, inbox, labeled, advance, pending, tasks };
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

describe("bandeja de Conversaciones", () => {
  it("guarda el hilo: lo del cliente y lo del bot, con no leídos y último mensaje", async () => {
    const s = await setup();
    await s.service.execute(T, s.message("Hola!"));
    const { conversations: [chat] } = await s.inbox.list(T, {});
    expect(chat).toMatchObject({ phone: "573001112233", unreadCount: 1, lastMessageAuthor: "bot", botEnabled: true });
    const { messages } = await s.inbox.messages(T, chat!.id);
    expect(messages.map((m) => [m.author, m.text])).toEqual([["contact", "Hola!"], ["bot", "¡Hola Laura! ¿Qué producto buscas?"]]);
    await s.inbox.markRead(T, chat!.id);
    expect((await s.inbox.get(T, chat!.id)).unreadCount).toBe(0);
  });

  it("con el bot pausado, el mensaje queda en el chat pero no inicia flujos", async () => {
    const s = await setup();
    await s.service.execute(T, s.message("buenas"));
    const { conversations: [chat] } = await s.inbox.list(T, {});
    await s.inbox.setBotEnabled(T, chat!.id, false);
    expect(await s.service.execute(T, s.message("hola"))).toMatchObject({ outcome: "bot_paused" });
    expect(s.sent).toHaveLength(0);
    expect((await s.inbox.messages(T, chat!.id)).messages.map((m) => m.text)).toEqual(["buenas", "hola"]);
  });

  it("si un asesor responde, se envía, queda en el hilo y el bot se pausa", async () => {
    const s = await setup();
    await s.service.execute(T, s.message("buenas"));
    const { conversations: [chat] } = await s.inbox.list(T, {});
    const updated = await s.inbox.sendAgentMessage(T, chat!.id, " Hola, soy Camilo ", { id: "u1", name: "Camilo" });
    expect(updated.botEnabled).toBe(false);
    expect(s.sent.at(-1)!.messages.map((m) => m.content)).toEqual(["Hola, soy Camilo"]);
    const last = (await s.inbox.messages(T, chat!.id)).messages.at(-1)!;
    expect(last).toMatchObject({ author: "agent", text: "Hola, soy Camilo", status: "sent", agentName: "Camilo" });
    await expect(s.inbox.sendAgentMessage(T, chat!.id, "   ", { id: "u1", name: null })).rejects.toThrow(/Escribe un mensaje/);
  });

  it("si WhatsApp no acepta la respuesta del asesor, queda en el hilo como fallida con su motivo", async () => {
    const s = await setup();
    await s.service.execute(T, s.message("buenas"));
    const { conversations: [chat] } = await s.inbox.list(T, {});
    (s.delivery.deliver as ReturnType<typeof vi.fn>).mockImplementationOnce(async (_t: string, _c: string, _p: string, messages: ReadonlyArray<OutboundMessage>) => ({
      sent: 0, failures: ["503"], results: messages.map((message) => ({ message, ok: false, error: "uazapi no está disponible (503)." }))
    }));
    await s.inbox.sendAgentMessage(T, chat!.id, "Hola", { id: "u1", name: null });
    expect((await s.inbox.messages(T, chat!.id)).messages.at(-1)).toMatchObject({ author: "agent", status: "failed", error: "uazapi no está disponible (503)." });
  });

  it("enviar un flujo a mano: corta el recorrido actual, lo empieza desde el inicio y reactiva el bot", async () => {
    const s = await setup();
    await s.service.execute(T, s.message("hola"));
    const { conversations: [chat] } = await s.inbox.list(T, {});
    await s.inbox.setBotEnabled(T, chat!.id, false);
    const result = await s.inbox.startFlow(T, chat!.id, FLOW_ID);
    expect(result).toMatchObject({ flowName: "Ventas", sent: 1, failed: 0 });
    expect(s.sent.at(-1)!.messages.map((m) => m.content)).toEqual(["¡Hola Laura! ¿Qué producto buscas?"]);
    expect((await s.inbox.get(T, chat!.id)).botEnabled).toBe(true);
    // La respuesta del cliente continúa el flujo enviado a mano.
    expect(await s.service.execute(T, s.message("tenis"))).toMatchObject({ outcome: "flow_continued" });
  });

  it("otra cuenta no ve ni toca el chat", async () => {
    const s = await setup();
    await s.service.execute(T, s.message("hola"));
    const { conversations: [chat] } = await s.inbox.list(T, {});
    const other = "99999999-9999-4999-8999-999999999999";
    expect((await s.inbox.list(other, {})).conversations).toEqual([]);
    await expect(s.inbox.messages(other, chat!.id)).rejects.toThrow(/no encontrada/);
  });

  it("etiquetar el chat etiqueta a su cliente; la bandeja filtra por etiquetas, bot, número y fecha", async () => {
    const s = await setup();
    // Sin disparador: el bot no responde y la fecha del chat es la del mensaje del cliente.
    await s.service.execute(T, s.message("buenas tardes"));
    await s.service.execute(T, s.message("buenas tardes", { phone: "573009998877", senderName: "Pedro", sentAt: "2026-11-01T12:00:00.000Z" }));
    const { conversations: chats } = await s.inbox.list(T, {});
    expect(chats.map((c) => c.phone)).toEqual(["573001112233", "573009998877"]);

    const laura = chats[0]!;
    const updated = await s.inbox.setLabels(T, laura.id, ["l-vip"]);
    expect(updated.labels).toEqual([{ id: "l-vip", name: "VIP", color: "#f59e0b" }]);
    expect(s.labeled).toEqual([{ contactId: laura.contactId, labelIds: ["l-vip"] }]);
    await expect(s.inbox.setLabels(T, laura.id, "l-vip")).rejects.toThrow(/lista/);

    const phones = async (query: Parameters<typeof s.inbox.list>[1]) => (await s.inbox.list(T, query)).conversations.map((c) => c.phone);
    expect(await phones({ labelIds: ["l-vip", "l-pago"] })).toEqual(["573001112233"]);
    expect(await phones({ labelIds: ["l-pago"] })).toEqual([]);
    expect(await phones({ from: "2026-11-09T00:00:00.000Z", to: "2026-11-10T00:00:00.000Z" })).toEqual(["573001112233"]);
    expect(await phones({ to: "2026-11-02T00:00:00.000Z" })).toEqual(["573009998877"]);
    expect(await phones({ connectionId: s.connectionId })).toHaveLength(2);
    expect(await phones({ connectionId: "otro" })).toEqual([]);
    await s.inbox.setBotEnabled(T, laura.id, false);
    expect(await phones({ filter: "bot_paused" })).toEqual(["573001112233"]);
    expect(await phones({ filter: "bot_active" })).toEqual(["573009998877"]);

    await expect(s.inbox.list(T, { from: "ayer" })).rejects.toThrow(/no es válida/);
    await expect(s.inbox.list(T, { from: "2026-11-10T00:00:00.000Z", to: "2026-11-09T00:00:00.000Z" })).rejects.toThrow(/anterior/);
    await expect(s.inbox.list(T, { cursor: "basura" })).rejects.toThrow(/página/);
  });

  it("la bandeja va por páginas de 50 con cursor, sin repetir ni saltar chats", async () => {
    const s = await setup();
    for (let i = 0; i < 53; i++) {
      const at = new Date(Date.UTC(2026, 10, 1, 0, i)).toISOString();
      const chat = await s.conversations.findOrCreate(T, s.connectionId, `57300${String(i).padStart(7, "0")}`, null);
      await s.conversations.append({
        id: `msg-${i}`, tenantId: T, conversationId: chat.id, direction: "inbound", author: "contact", kind: "text", text: `m${i}`,
        mediaUrl: null, mediaType: null, options: [], status: "received", error: null, flowKey: null, agentId: null, agentName: null,
        providerMessageId: null, createdAt: at
      });
    }
    const first = await s.inbox.list(T, {});
    expect(first.conversations).toHaveLength(50);
    expect(first.conversations[0]!.lastMessageText).toBe("m52");
    expect(first.nextCursor).toEqual(expect.any(String));
    const second = await s.inbox.list(T, { cursor: first.nextCursor! });
    expect(second.conversations.map((c) => c.lastMessageText)).toEqual(["m2", "m1", "m0"]);
    expect(second.nextCursor).toBeNull();
  });

  it("si el número del chat fue eliminado, el historial se lee y se etiqueta, pero no se responde ni se ejecutan flujos", async () => {
    const s = await setup();
    await s.service.execute(T, s.message("buenas tardes"));
    const { conversations: [chat] } = await s.inbox.list(T, {});
    s.conversations.deletedConnections.add(s.connectionId);

    expect((await s.inbox.get(T, chat!.id)).connectionDeleted).toBe(true);
    expect((await s.inbox.messages(T, chat!.id)).messages.map((m) => m.text)).toEqual(["buenas tardes"]);
    await s.inbox.markRead(T, chat!.id);
    expect((await s.inbox.setLabels(T, chat!.id, ["l-vip"])).labels).toHaveLength(1);
    await expect(s.inbox.sendAgentMessage(T, chat!.id, "Hola", { id: "u1", name: null })).rejects.toThrow(/fue eliminado/);
    await expect(s.inbox.startFlow(T, chat!.id, FLOW_ID)).rejects.toThrow(/fue eliminado/);
    await expect(s.inbox.setBotEnabled(T, chat!.id, false)).rejects.toThrow(/fue eliminado/);
    expect(s.delivery.deliver).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// FASE C6 — despertadores con la cola de tareas: pausa larga de un Mensaje,
// Programador, «Tiempo agotado» de una espera; un mensaje durante el
// Programador no lo mueve; responder a tiempo cancela el vencimiento; con el
// bot pausado no se mueve nada y el flujo sigue al reactivarlo.
// ---------------------------------------------------------------------------

const TIMED_FLOW: FlowSnapshot = {
  ...FLOW,
  nodes: {
    start: node("start", "start"),
    bienvenida: node("bienvenida", "message", { items: [
      { id: "t1", kind: "text", text: "Hola" },
      { id: "p1", kind: "interval", amount: 30, unit: "seconds" },
      { id: "t2", kind: "text", text: "Seguimos" }
    ] }),
    programador: node("programador", "delay", { trigger: "interval", wait: { amount: 3, unit: "minutes" }, moment: null, scheduleEnabled: false }),
    pregunta: node("pregunta", "question", { waitIndefinitely: false, timeout: { amount: 30, unit: "minutes" }, targetKey: "resp" }),
    gracias: node("gracias", "message", { items: [{ id: "t", kind: "text", text: "Gracias por responder" }] }),
    recordatorio: node("recordatorio", "message", { items: [{ id: "t", kind: "text", text: "¿Sigues ahí?" }] })
  },
  edgesBySource: {
    start: [edge("start", "bienvenida")],
    bienvenida: [edge("bienvenida", "programador")],
    programador: [edge("programador", "pregunta")],
    pregunta: [edge("pregunta", "gracias", "respuesta"), edge("pregunta", "recordatorio", "tiempo-agotado")]
  }
} as unknown as FlowSnapshot;

const texts = (sent: ReadonlyArray<{ messages: ReadonlyArray<OutboundMessage> }>) => sent.flatMap((s) => s.messages.filter((m) => m.kind !== "pause" && m.kind !== "presence").map((m) => m.content));
const MIN = 60_000;

describe("despertadores de los flujos (cola de tareas)", () => {
  it("pausa larga, Programador y «Tiempo agotado»: cada parte sale a su hora, en orden", async () => {
    const s = await setup({ flow: TIMED_FLOW });
    await s.service.execute(T, s.message("hola"));
    // La pausa de 30 s no cabe en el turno: sale «Hola» y el resto espera a la cola.
    expect(texts(s.sent)).toEqual(["Hola"]);
    expect(s.pending()).toHaveLength(1);
    expect(s.pending()[0]!.dueAt).toBe("2026-11-09T12:00:30.000Z");

    await s.advance(29_000);
    expect(texts(s.sent)).toEqual(["Hola"]);
    await s.advance(1_000);
    expect(texts(s.sent)).toEqual(["Hola", "Seguimos"]);
    // Ahora el Programador: un único despertador, a los 3 minutos.
    expect(s.pending().map((task) => task.dueAt)).toEqual(["2026-11-09T12:03:30.000Z"]);

    // Escribir durante el Programador no lo mueve ni lo duplica.
    await s.service.execute(T, s.message("¿ya?"));
    expect(texts(s.sent)).toEqual(["Hola", "Seguimos"]);
    expect(s.pending()).toHaveLength(1);

    await s.advance(3 * MIN);
    expect(s.pending().map((task) => task.dueAt)).toEqual(["2026-11-09T12:33:30.000Z"]);
    await s.advance(30 * MIN);
    expect(texts(s.sent)).toEqual(["Hola", "Seguimos", "¿Sigues ahí?"]);
    expect(s.pending()).toEqual([]);
    expect((await s.sessionsRepo.find(`${T}:${conversationKeyFor(s.connectionId, "573001112233")}`))!.status).toBe("completed");
    // Todo quedó en el chat.
    expect(s.conversations.stored.filter((m) => m.author === "bot").map((m) => m.text)).toEqual(["Hola", "Seguimos", "¿Sigues ahí?"]);
  });

  it("responder a tiempo sigue por «Respuesta» y cancela el vencimiento", async () => {
    const s = await setup({ flow: TIMED_FLOW });
    await s.service.execute(T, s.message("hola"));
    await s.advance(30_000);
    await s.advance(3 * MIN);
    await s.service.execute(T, s.message("aquí estoy"));
    expect(texts(s.sent).at(-1)).toBe("Gracias por responder");
    expect(s.pending()).toEqual([]);
    await s.advance(40 * MIN);
    expect(texts(s.sent)).not.toContain("¿Sigues ahí?");
  });

  it("con el bot pausado el despertador no mueve el flujo; al reactivarlo, el próximo mensaje lo retoma", async () => {
    const s = await setup({ flow: TIMED_FLOW });
    await s.service.execute(T, s.message("hola"));
    await s.advance(30_000);
    const { conversations: [chat] } = await s.inbox.list(T, {});
    await s.inbox.setBotEnabled(T, chat!.id, false);
    const report = await s.advance(3 * MIN);
    expect(report.completed).toBe(1);
    expect(texts(s.sent)).toEqual(["Hola", "Seguimos"]);

    await s.inbox.setBotEnabled(T, chat!.id, true);
    await s.service.execute(T, s.message("volví"));
    // El Programador ya había vencido: el mensaje lo retoma y el flujo sigue a la pregunta.
    expect((await s.sessionsRepo.find(`${T}:${conversationKeyFor(s.connectionId, "573001112233")}`))!.currentNodeId).toBe("pregunta");
    expect(s.pending()).toHaveLength(1);
  });

  it("una sesión que quedó esperando con la versión anterior (sin despertador ni hora) sigue con el próximo mensaje", async () => {
    const s = await setup({ flow: TIMED_FLOW });
    await s.service.execute(T, s.message("hola"));
    await s.advance(30_000);
    // Antes de la cola de tareas: la sesión quedaba en el Programador sin hora guardada y sin tarea.
    const key = `${T}:${conversationKeyFor(s.connectionId, "573001112233")}`;
    const waiting = (await s.sessionsRepo.find(key))!;
    const { [WAKE_CONTEXT_KEY]: _wake, ...legacy } = waiting.context;
    await s.sessionsRepo.save({ ...waiting, context: legacy });
    for (const task of s.pending()) s.tasks.tasks.set(task.id, { ...task, status: "cancelled" });

    await s.service.execute(T, s.message("¿sigue?"));
    // El Programador ya había vencido: sigue a la pregunta, que espera con su despertador.
    expect((await s.sessionsRepo.find(key))!.currentNodeId).toBe("pregunta");
    expect(s.pending()).toHaveLength(1);
  });

  it("un despertador vencido (la sesión ya avanzó) no hace nada", async () => {
    const s = await setup({ flow: TIMED_FLOW });
    await s.service.execute(T, s.message("hola"));
    const stale = s.pending()[0]!;
    await s.advance(30_000);
    // Se vuelve a poner el despertador viejo, como si una ronda lo repitiera.
    s.tasks.tasks.set("viejo", { ...stale, id: "viejo", dedupeKey: "viejo", status: "pending" });
    const before = s.sent.length;
    await s.advance(1_000);
    expect(s.sent.slice(before).flatMap((x) => x.messages)).toEqual([]);
    expect(s.tasks.tasks.get("viejo")!.status).toBe("done");
  });
});
