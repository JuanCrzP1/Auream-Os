import type { FlowNode } from "../../../contracts/FlowSnapshot";
import type { NodeExecutionResult, RuntimeInput } from "../../../contracts/RuntimeContracts";
import type { Session } from "../../../contracts/RuntimeContracts";
import type { NodeHandler } from "../NodeHandler";

// ---------------------------------------------------------------------------
// StartNodeHandler
//
// El bloque de inicio no hace nada: marca dónde empieza el flujo y pasa al
// siguiente bloque. No envía mensajes (el antiguo inicio de tipo `message`
// enviaba «Inicio del flujo» al cliente).
// ---------------------------------------------------------------------------

export class StartNodeHandler implements NodeHandler {
  public supports(nodeType: FlowNode["type"]): boolean {
    return nodeType === "start";
  }

  public async execute(node: FlowNode, _input: RuntimeInput, _session: Session): Promise<NodeExecutionResult> {
    return {
      executionStatus: "success",
      outputMessages: [],
      contextPatch: {},
      nodeResult: {},
      domainEvents: [`start_node_executed:${node.id}`]
    };
  }
}
