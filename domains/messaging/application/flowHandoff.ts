import { GO_TO_FLOW_MAX_CHAIN, HANDOFF_PAYLOAD, type FlowHandoff } from "../../../contracts/GoToFlowConfig";
import type { InboundEnvelope } from "../../../contracts/RuntimeContracts";
import type { FlowCatalog } from "../../connections/application/ports/FlowCatalog";
import type { FlowTurnTarget } from "./ports/MessagingPorts";

// ---------------------------------------------------------------------------
// «Ir a otro flujo», del lado de quien corre el turno: a qué flujo pasa el
// cliente y con qué mensaje arranca. Las protecciones viven aquí:
//
//   · el flujo tiene que ser de la cuenta, no estar archivado ni pausado
//   · no puede ser el mismo flujo
//   · una cadena de saltos en un mismo turno se corta a los 5 (A → B → A…)
//
// Un salto que no se hace no rompe nada: el flujo de origen ya terminó y
// queda anotado por qué (`go_to_flow_refused:<motivo>`).
// ---------------------------------------------------------------------------

export type HandoffStep =
  | { readonly kind: "go"; readonly target: FlowTurnTarget; readonly envelope: InboundEnvelope }
  | { readonly kind: "refused"; readonly event: string };

/** Cuántos saltos lleva el turno (0 si el flujo no empezó por un salto). */
export function handoffDepth(envelope: InboundEnvelope): number {
  const depth = envelope.payload[HANDOFF_PAYLOAD.depth];
  return typeof depth === "number" && Number.isInteger(depth) && depth > 0 ? depth : 0;
}

/** El siguiente flujo y el mensaje con que arranca, o por qué no se salta. */
export async function nextHandoff(
  flows: FlowCatalog | undefined,
  target: FlowTurnTarget,
  envelope: InboundEnvelope,
  handoff: FlowHandoff,
  at: Date
): Promise<HandoffStep> {
  const refused = (reason: string): HandoffStep => ({ kind: "refused", event: `go_to_flow_refused:${reason}:${handoff.flowName || handoff.flowId}` });
  if (!flows) return refused("unavailable");
  const depth = handoffDepth(envelope);
  if (depth >= GO_TO_FLOW_MAX_CHAIN) return refused("chain_limit");

  const [flow] = await flows.findMany(target.tenantId, [handoff.flowId]);
  if (!flow) return refused("missing");
  if (flow.archived) return refused("archived");
  if (flow.paused) return refused("paused");
  if (flow.key === target.flowKey) return refused("same_flow");

  const when = at.toISOString();
  return {
    kind: "go",
    target: { ...target, flowKey: flow.key },
    envelope: {
      tenantId: target.tenantId,
      flowKey: flow.key,
      channel: envelope.channel,
      conversationKey: envelope.conversationKey,
      userKey: envelope.userKey,
      messageId: `handoff:${flow.id}:${when}`,
      payload: { text: "", handoff: true, [HANDOFF_PAYLOAD.depth]: depth + 1, [HANDOFF_PAYLOAD.context]: handoff.context },
      receivedAt: when
    }
  };
}
