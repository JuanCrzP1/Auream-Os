import { describe, expect, it, vi } from "vitest";
import type { FlowSnapshot } from "../../contracts/FlowSnapshot.js";
import type { RuntimeInput } from "../../contracts/RuntimeContracts.js";
import type { ContactProfile } from "../../contracts/ContactContracts.js";
import { greetingAt, templateResolver } from "../../flow-engine/templates/templateResolver.js";
import { ExecutionOrchestrator } from "../../flow-engine/execution/ExecutionOrchestrator.js";
import { ExecutionLoop } from "../../flow-engine/execution/ExecutionLoop.js";
import { EdgeEvaluator } from "../../flow-engine/edges/EdgeEvaluator.js";
import { ExecutionEventTracker } from "../../flow-engine/execution/ExecutionEventTracker.js";
import { InMemoryFlowRegistry } from "../../infrastructure/persistence/memory/InMemoryFlowRegistry.js";
import { SessionService } from "../../domains/sessions/application/SessionService.js";
import { ContextService } from "../../domains/sessions/application/ContextService.js";
import { AnalyticsService } from "../../domains/analytics/application/AnalyticsService.js";
import { InMemorySessionRepository } from "../../infrastructure/persistence/memory/InMemorySessionRepository.js";
import { DefaultTimezoneTenantResolver } from "../../platform/tenancy/application/TenantResolver.js";
import { composeNodeRuntime, simulationDependencies } from "../../apps/api/composition/composeNodeRuntime.js";
import { SimulateTurnService } from "../../domains/automations/simulation/application/SimulateTurnService.js";
import { composeSimulationSandbox } from "../../apps/api/composition/composeSimulationSandbox.js";
import { buildInitialBuilderWorkspace } from "../../apps/api/composition/buildInitialBuilderWorkspace.js";
import { DisabledAiGateway } from "../../infrastructure/ai/DisabledAiGateway.js";
import { DisabledHttpRequester } from "../../infrastructure/http/DisabledHttpRequester.js";
import type { BuilderFlowNode } from "../../contracts/FlowSnapshot.js";
import type { SimulationTurnResponse } from "../../contracts/SimulationContracts.js";

// ---------------------------------------------------------------------------
// Las variables del sistema, como en Leona: `{saludo}`, `{dia}`, `{data}`
// (día/mes), `{created_at}`, quién atiende y por qué número; los nombres de
// Leona que Auream llama distinto; el Condicional comparando con variables y
// el error de la Integración en `{integracion.error}` / `{response.erro}`.
// ---------------------------------------------------------------------------

const input = (over: Partial<RuntimeInput> = {}, context: Record<string, unknown> = {}): RuntimeInput =>
  ({
    envelope: { tenantId: "t", flowKey: "f", channel: "whatsapp", conversationKey: "c", userKey: "584121110011", messageId: "m", payload: {}, receivedAt: "2026-11-13T19:35:00.000Z" },
    sessionContext: context,
    isWaitingInput: false,
    // Viernes 13 nov 2026, 2:35 p. m. en Bogotá.
    now: "2026-11-13T19:35:00.000Z",
    timezone: "America/Bogota",
    ...over
  }) as RuntimeInput;

const profile = { id: "c1", name: "Laura Gómez", phone: "584121110011", email: null, tags: [], fields: {}, createdAt: "2026-11-01T13:05:09.000Z" } as ContactProfile;

describe("variables del sistema", () => {
  it("del reloj, en la hora del negocio: {data} es día/mes como en Leona, {dia} y {saludo}", () => {
    const resolve = templateResolver(input(), profile);
    expect(["fecha", "data", "hora", "dia", "saludo"].map(resolve)).toEqual(["13/11/2026", "13/11", "14:35", "viernes", "Buenas tardes"]);
    expect([greetingAt(5), greetingAt(11), greetingAt(12), greetingAt(18), greetingAt(19), greetingAt(2)]).toEqual(["Buenos días", "Buenos días", "Buenas tardes", "Buenas tardes", "Buenas noches", "Buenas noches"]);
  });

  it("del cliente y la conversación: cuándo llegó, quién lo atiende y por qué número", () => {
    const resolve = templateResolver(input({ conversation: { assigneeName: "Camilo", connectionName: "Ventas", connectionNumber: "573001112233" } }), profile);
    expect(["created_at", "attendant_name", "instance_name", "instance_number"].map(resolve)).toEqual(["01/11/2026 08:05:09", "Camilo", "Ventas", "573001112233"]);
    expect(templateResolver(input(), profile)("attendant_name")).toBeUndefined();
  });

  it("los nombres de Leona valen lo mismo, salvo que el flujo guarde su propio dato con ese nombre", () => {
    const context = { "ia.respuesta": "Claro que sí", "comprobante.valor": 5500, "comprobante.fecha": "13/11/2026" };
    const resolve = templateResolver(input({}, context), profile);
    expect(["phone_number", "ai.response", "comprovante.valor", "comprovante.data"].map(resolve)).toEqual(["584121110011", "Claro que sí", 5500, "13/11/2026"]);
    expect(templateResolver(input({}, { ...context, "comprovante.valor": 99 }), profile)("comprovante.valor")).toBe(99);
  });
});

describe("el motor pide quién atiende y el número solo si el flujo los usa", () => {
  const node = (id: string, type: string, config: Record<string, unknown> = {}) => ({ id, tenantId: "t", flowVersionId: "v1", type, name: id, content: {}, config, metadata: {} });
  const flowWith = (text: string): FlowSnapshot =>
    ({
      flow: { id: "f", tenantId: "t", key: "f", name: "F", currentPublishedVersionId: "v1" },
      version: { id: "v1", tenantId: "t", flowId: "f", versionNumber: 1, status: "published", entryNodeId: "start" },
      nodes: { start: node("start", "start"), hola: node("hola", "message", { items: [{ id: "t", kind: "text", text }] }) },
      edgesBySource: { start: [{ id: "e", fromNodeId: "start", toNodeId: "hola", priority: 10, isFallback: false, condition: { operator: "always" } }] }
    }) as unknown as FlowSnapshot;

  async function run(text: string) {
    const registry = new InMemoryFlowRegistry();
    await registry.publish(flowWith(text));
    const sessions = new SessionService(new InMemorySessionRepository());
    const reader = { facts: vi.fn(async () => ({ assigneeName: "Camilo", connectionName: "Ventas", connectionNumber: "573001112233" })) };
    const engine = new ExecutionOrchestrator(
      new DefaultTimezoneTenantResolver("America/Bogota"),
      registry,
      sessions,
      new ExecutionLoop(sessions, new ContextService(), composeNodeRuntime(simulationDependencies()), new EdgeEvaluator(), new ExecutionEventTracker(new AnalyticsService())),
      undefined,
      reader
    );
    const result = await engine.handle({ tenantId: "t", flowKey: "f", channel: "whatsapp", conversationKey: "conn:584121110011", userKey: "584121110011", messageId: "m", payload: { text: "hola" }, receivedAt: new Date().toISOString() });
    return { texts: result.outputMessages.map((message) => message.content), calls: reader.facts.mock.calls.length };
  }

  it("con la variable en el flujo, la consulta una vez; sin ella, no consulta nada", async () => {
    expect(await run("Te atiende {attendant_name} desde {instance_name}")).toEqual({ texts: ["Te atiende Camilo desde Ventas"], calls: 1 });
    expect(await run("Hola {first_name}")).toMatchObject({ calls: 0 });
  });
});

describe("en el laboratorio", () => {
  const T = "tenant-sim";
  const always = { operator: "always" as const };
  const link = (from: string, to: string, fromOutput?: string) => ({ id: `${from}-${to}-${fromOutput ?? ""}`, fromNodeId: from, toNodeId: to, priority: 10, isFallback: false, condition: always, ...(fromOutput ? { fromOutput } : {}) });
  const node = (id: string, type: string, config: Record<string, unknown>): BuilderFlowNode => ({ id, type: type as BuilderFlowNode["type"], name: id, content: {}, config, metadata: {} });
  const text = (id: string, value: string) => node(id, "message", { items: [{ id: `${id}-t`, kind: "text", text: value }] });

  async function lab(nodes: Record<string, BuilderFlowNode>, edges: Record<string, ReturnType<typeof link>[]>, realIntegrations = false): Promise<SimulationTurnResponse> {
    const base = buildInitialBuilderWorkspace(T, "flujo");
    const ws = { ...base, draft: { ...base.draft, nodes: { ...base.draft.nodes, ...nodes }, edgesBySource: edges } };
    const service = new SimulateTurnService(composeSimulationSandbox({ ai: new DisabledAiGateway(), http: new DisabledHttpRequester(), timezoneOf: async () => "America/Bogota" }));
    return service.execute(T, ws, { draft: ws.draft, state: null, event: { type: "start" }, options: { realAi: false, realIntegrations } });
  }
  const sent = (result: SimulationTurnResponse) => result.messages.filter((message) => message.kind !== "pause").map((message) => message.text);

  it("el Condicional compara contra una variable, como en Leona («es igual a {ref_anterior}»)", async () => {
    const result = await lab(
      {
        nueva: node("nueva", "set-field", { field: "ref_nuevo", operation: "set", value: "778899" }),
        vieja: node("vieja", "set-field", { field: "ref_anterior", operation: "set", value: "778899" }),
        mirar: node("mirar", "condition", { match: "all", rules: [{ id: "r", category: "customField", field: "ref_nuevo", operator: "equal", value: "{ref_anterior}" }] }),
        repetido: text("repetido", "Ese comprobante ya lo usaste"),
        nuevo: text("nuevo", "Comprobante nuevo")
      },
      { start: [link("start", "nueva")], nueva: [link("nueva", "vieja")], vieja: [link("vieja", "mirar")], mirar: [link("mirar", "repetido", "true"), link("mirar", "nuevo", "false")] }
    );
    expect(sent(result)).toEqual(["Ese comprobante ya lo usaste"]);
  });

  it("la Integración que falla deja su motivo en {integracion.error} y en {response.erro}; el laboratorio muestra quién atiende", async () => {
    const result = await lab(
      {
        pedir: node("pedir", "integration", { method: "GET", url: "https://api.ejemplo.com/estado", headers: [], body: "", responseMappings: [] }),
        aviso: text("aviso", "Falló: {response.erro|sin motivo}"),
        quien: text("quien", "Te atiende {attendant_name}")
      },
      { start: [link("start", "quien")], quien: [link("quien", "pedir")], pedir: [link("pedir", "aviso", "failure")] },
      // De verdad (en la prueba no hay red: falla siempre).
      true
    );
    const [who, failure] = sent(result);
    expect(who).toBe("Te atiende Asesor de prueba");
    expect(failure).toMatch(/^Falló: (?!sin motivo).+/);
    expect(result.variables).toHaveProperty("integracion.error");
  });
});
