import { randomUUID } from "node:crypto";
import type { PersistedBuilderWorkspace } from "../../../../contracts/BuilderContracts";
import type { FlowSnapshot } from "../../../../contracts/FlowSnapshot";
import type { InboundEnvelope, Session } from "../../../../contracts/RuntimeContracts";
import { timerEnvelope } from "../../../../contracts/FlowTimerContracts";
import type { SimulationEvent, SimulationState, SimulationStatus, SimulationTurnResponse, SimulationWait } from "../../../../contracts/SimulationContracts";
import { ValidationError } from "../../../../platform/observability/errors/ValidationError";
import { TooManyRequestsError } from "../../../../platform/observability/errors/TooManyRequestsError";
import type { RateLimiter } from "../../../../platform/security/rate-limiting/application/RateLimiter";
import { convertBuilderSnapshotToRuntime } from "../../builder/application/convertBuilderSnapshotToRuntime";
import { isBuilderFlowSnapshot } from "../../builder/application/isBuilderFlowSnapshot";
import { describeMessages, describeSteps, isInternalKey } from "../domain/describeTurn";
import { readEvent, readOptions, readState } from "../domain/simulationInput";
import type { SimulationSandboxFactory } from "./SimulationSandbox";

// ---------------------------------------------------------------------------
// Un turno del laboratorio de pruebas del editor: lo que está en el lienzo
// (guardado o no) contra el cliente de prueba, con el motor real en un
// arenero (`SimulationSandbox`). El estado de la prueba lo trae y se lo lleva
// el navegador. El resultado: qué bloques recorrió y por qué salida siguió,
// qué hizo cada uno, qué le habría mandado al cliente y cómo quedó.
// ---------------------------------------------------------------------------

/** Canal de las pruebas: nunca es un canal real, así nada sale por WhatsApp. */
export const SIMULATION_CHANNEL = "builder-simulator";

/** Turnos de prueba por cuenta: holgado para probar a mano, corta abusos (la IA y la Integración reales cuestan). */
export const SIMULATION_POLICY = { windowMs: 60_000, maxRequests: 120 } as const;

const CHANGED_NOTICE = "El flujo cambió donde estaba la prueba: empezó de nuevo desde el inicio.";
const DELAYED_NOTICE = "El flujo está detenido en un Programador: usa «Saltar espera» para continuar.";

function statusOf(session: Session | null): SimulationStatus {
  switch (session?.status) {
    case "waiting_input":
    case "paused":
      return "waiting_reply";
    case "delayed":
      return "waiting_timer";
    case "failed":
      return "failed";
    default:
      return "finished";
  }
}

export class SimulateTurnService {
  public constructor(
    private readonly sandboxes: SimulationSandboxFactory,
    private readonly limiter?: RateLimiter
  ) {}

  public async execute(tenantId: string, workspace: PersistedBuilderWorkspace, body: Readonly<Record<string, unknown>>): Promise<SimulationTurnResponse> {
    const limit = this.limiter ? await this.limiter.check(`simulation:${tenantId}`, SIMULATION_POLICY) : null;
    if (limit && !limit.allowed) throw new TooManyRequestsError("Demasiadas pruebas seguidas. Espera un momento.", limit.retryAfterMs);
    if (!isBuilderFlowSnapshot(body["draft"])) throw new ValidationError("El flujo a probar no tiene la forma de un flujo.");
    // La identidad del flujo la fija el servidor (como al guardar).
    const draft = { ...body["draft"], flow: { ...body["draft"].flow, id: workspace.draft.flow.id, key: workspace.flowKey } };
    const snapshot = convertBuilderSnapshotToRuntime(draft, tenantId);
    const state = readState(body["state"], tenantId, snapshot.flow.id);
    const event = readEvent(body["event"]);

    let session: Session | null = event.type === "start" ? null : state.session;
    let notice: string | null = null;
    if (session && !snapshot.nodes[session.currentNodeId]) {
      session = null;
      notice = CHANGED_NOTICE;
    } else if (session) {
      // Los cambios del lienzo valen al instante: la prueba sigue sobre la versión de ahora.
      session = { ...session, flowVersionId: snapshot.version.id };
    }

    const envelope = this.envelopeFor(tenantId, snapshot, state, event);
    const run = await this.sandboxes.create({ tenantId, persona: state.persona, counters: state.counters, options: readOptions(body["options"]) }).run(snapshot, session, envelope);
    if (run.result.untouched && session?.status === "delayed" && event.type !== "skip-wait") notice = DELAYED_NOTICE;

    const finalSession = run.session ?? session;
    const wait: SimulationWait | null = run.result.wakeUp
      ? { reason: run.result.wakeUp.reason, nodeId: run.result.wakeUp.nodeId, revision: run.result.wakeUp.revision, until: run.result.wakeUp.at }
      : run.result.untouched
        ? state.wait
        : null;
    const variables = Object.fromEntries(Object.entries(finalSession?.context ?? {}).filter(([key]) => !isInternalKey(key)));

    return {
      state: { session: finalSession, persona: run.persona, wait, counters: run.counters },
      status: statusOf(finalSession),
      steps: describeSteps(draft, run.records),
      messages: describeMessages(run.records),
      wait,
      variables,
      notice,
      serverTime: new Date().toISOString()
    };
  }

  private envelopeFor(tenantId: string, snapshot: FlowSnapshot, state: SimulationState, event: SimulationEvent): InboundEnvelope {
    const base = {
      tenantId,
      flowKey: snapshot.flow.key,
      channel: SIMULATION_CHANNEL,
      conversationKey: `simulacion:${snapshot.flow.key}`,
      userKey: state.persona.phone,
      receivedAt: new Date().toISOString()
    };
    if (event.type === "skip-wait") {
      if (!state.wait) throw new ValidationError("No hay ninguna espera pendiente.");
      return timerEnvelope(base, { reason: state.wait.reason, nodeId: state.wait.nodeId, revision: state.wait.revision });
    }
    const payload = event.type === "message" ? { text: event.text } : event.type === "choice" ? { text: event.title, optionId: event.optionId } : { text: "" };
    return { ...base, messageId: `sim-${randomUUID()}`, payload };
  }
}
