import type { FlowSnapshot } from "../../../contracts/FlowSnapshot";
import type { InboundEnvelope, Session } from "../../../contracts/RuntimeContracts";
import type { SimulationOptions, SimulationPersona } from "../../../contracts/SimulationContracts";
import { AnalyticsService } from "../../../domains/analytics/application/AnalyticsService";
import type { SandboxRun, SimulationSandbox, SimulationSandboxFactory } from "../../../domains/automations/simulation/application/SimulationSandbox";
import { SimulationJournal } from "../../../domains/automations/simulation/domain/SimulationJournal";
import { ContextService } from "../../../domains/sessions/application/ContextService";
import { SessionService, sessionIdFor } from "../../../domains/sessions/application/SessionService";
import { EdgeEvaluator } from "../../../flow-engine/edges/EdgeEvaluator";
import { ExecutionEventTracker } from "../../../flow-engine/execution/ExecutionEventTracker";
import { ExecutionLoop } from "../../../flow-engine/execution/ExecutionLoop";
import { ExecutionOrchestrator } from "../../../flow-engine/execution/ExecutionOrchestrator";
import type { AiGateway } from "../../../flow-engine/ports/AiGateway";
import type { SalesLedger } from "../../../flow-engine/ports/SalesLedger";
import type { HttpRequester } from "../../../flow-engine/ports/HttpRequester";
import { DisabledDocumentReader } from "../../../infrastructure/documents/DisabledDocumentReader";
import { DisabledHttpRequester } from "../../../infrastructure/http/DisabledHttpRequester";
import { InMemoryFlowRegistry } from "../../../infrastructure/persistence/memory/InMemoryFlowRegistry";
import { InMemoryReceiptRegistry } from "../../../infrastructure/persistence/memory/InMemoryReceiptRegistry";
import { InMemorySessionRepository } from "../../../infrastructure/persistence/memory/InMemorySessionRepository";
import { JournaledNodeRuntime } from "../../../infrastructure/simulation/JournaledNodeRuntime";
import { SimulatedRoundRobinCounter } from "../../../infrastructure/simulation/SimulatedRoundRobinCounter";
import { SimulatedContactDirectory } from "../../../infrastructure/simulation/SimulatedContactDirectory";
import { JournaledAiGateway, JournaledHttpRequester, SimulatedAiGateway, SimulatedConversionTracker, SimulatedHttpRequester } from "../../../infrastructure/simulation/SimulatedEffects";
import { StaticTenantResolver } from "../../../platform/tenancy/application/TenantResolver";
import { composeNodeRuntime } from "./composeNodeRuntime";

// ---------------------------------------------------------------------------
// El arenero del laboratorio de pruebas: el motor de flujos real, armado de
// cero en cada turno con efectos de prueba. Nada sale por WhatsApp (el canal
// es el del simulador), el contacto es el cliente de prueba, el Pixel no va a
// Meta y la IA y la Integración reales solo si se piden (con la pasarela de
// IA y el cliente HTTP protegido de la cuenta). Sin estado entre turnos.
// ---------------------------------------------------------------------------

const SIMULATION_LIMITS = { maxActiveSessions: 1, maxWebhookRetries: 0 } as const;

export interface SimulationSandboxDependencies {
  /** IA con las conexiones de la cuenta (solo si se pide «Usar IA real»). */
  readonly ai: AiGateway;
  /** Cliente HTTP protegido (solo si se pide «Integraciones reales»). */
  readonly http: HttpRequester;
  /** Zona horaria de la empresa (reglas de día y hora, Programador). */
  readonly timezoneOf: (tenantId: string) => Promise<string>;
  /** Registrar venta: calcula la venta con el catálogo de la cuenta SIN guardarla. */
  readonly sales: SalesLedger;
}

class TurnSandbox implements SimulationSandbox {
  public constructor(
    private readonly deps: SimulationSandboxDependencies,
    private readonly tenantId: string,
    private readonly persona: SimulationPersona,
    private readonly counters: Readonly<Record<string, number>>,
    private readonly options: SimulationOptions
  ) {}

  public async run(snapshot: FlowSnapshot, session: Session | null, envelope: InboundEnvelope): Promise<SandboxRun> {
    const journal = new SimulationJournal();
    const contacts = new SimulatedContactDirectory(this.persona, journal);
    const roundRobin = new SimulatedRoundRobinCounter(this.counters);
    const nodes = composeNodeRuntime({
      roundRobin,
      contacts,
      http: this.options.realIntegrations ? new JournaledHttpRequester(this.deps.http, journal) : new SimulatedHttpRequester(journal),
      ai: this.options.realAi ? new JournaledAiGateway(this.deps.ai, journal) : new SimulatedAiGateway(journal),
      conversions: new SimulatedConversionTracker(journal),
      media: new DisabledHttpRequester(),
      documents: new DisabledDocumentReader(),
      receipts: new InMemoryReceiptRegistry(),
      sales: this.deps.sales
    });

    const sessions = new InMemorySessionRepository();
    if (session) await sessions.save(session);
    const registry = new InMemoryFlowRegistry();
    await registry.publish(snapshot);
    const sessionService = new SessionService(sessions);
    const loop = new ExecutionLoop(sessionService, new ContextService(), new JournaledNodeRuntime(nodes, journal), new EdgeEvaluator(), new ExecutionEventTracker(new AnalyticsService()));
    const timezone = await this.deps.timezoneOf(this.tenantId);
    const tenants = new StaticTenantResolver({ [this.tenantId]: { tenantId: this.tenantId, tenantKey: this.tenantId, timezone, limits: SIMULATION_LIMITS } });

    const result = await new ExecutionOrchestrator(tenants, registry, sessionService, loop).handle(envelope);
    const after = (await sessions.find(sessionIdFor(this.tenantId, envelope.conversationKey))) ?? null;
    return { result, session: after, persona: contacts.current(), records: journal.entries(), counters: roundRobin.snapshot() };
  }
}

export function composeSimulationSandbox(deps: SimulationSandboxDependencies): SimulationSandboxFactory {
  return { create: ({ tenantId, persona, counters, options }) => new TurnSandbox(deps, tenantId, persona, counters, options) };
}
