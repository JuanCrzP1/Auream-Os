import type { FlowNode } from "../../../contracts/FlowSnapshot";
import { readGoToFlowConfig } from "../../../contracts/GoToFlowConfig";
import type { NodeExecutionResult, RuntimeInput, Session } from "../../../contracts/RuntimeContracts";
import type { NodeHandler } from "../NodeHandler";

// ---------------------------------------------------------------------------
// GoToFlowNodeHandler — el bloque «Ir a otro flujo» (la Conexión de flujo de
// Leona). Este flujo termina aquí y pide el salto (`handoff`) con los datos
// que guardó la conversación (sin los internos `__…`): el motor no conoce los
// demás flujos, así que quien corre el turno (`FlowTurn`) arranca el otro.
// Sin flujo elegido, el flujo solo termina y queda anotado.
// ---------------------------------------------------------------------------

export class GoToFlowNodeHandler implements NodeHandler {
  public supports(nodeType: FlowNode["type"]): boolean {
    return nodeType === "go-to-flow";
  }

  public async execute(node: FlowNode, input: RuntimeInput, _session: Session): Promise<NodeExecutionResult> {
    const config = readGoToFlowConfig(node.config);
    if (!config.flowId) {
      return { executionStatus: "completed", outputMessages: [], contextPatch: {}, nodeResult: {}, domainEvents: [`go_to_flow_skipped:${node.id}:no_flow`] };
    }

    const context = Object.fromEntries(Object.entries(input.sessionContext).filter(([key]) => !key.startsWith("__")));
    return {
      executionStatus: "completed",
      outputMessages: [],
      contextPatch: {},
      nodeResult: { flowId: config.flowId, flowName: config.flowName },
      domainEvents: [`go_to_flow:${node.id}:${config.flowName || config.flowId}`],
      handoff: { flowId: config.flowId, flowName: config.flowName, context }
    };
  }
}
