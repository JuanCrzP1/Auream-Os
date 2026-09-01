import type { FlowNode } from "../../../contracts/FlowSnapshot";
import type { NodeExecutionResult, RuntimeInput } from "../../../contracts/RuntimeContracts";
import type { Session } from "../../../contracts/RuntimeContracts";
import type { NodeHandler } from "../NodeHandler";

// ---------------------------------------------------------------------------
// ActionNodeHandler
//
// Estado: NO IMPLEMENTADO.
//
// Un nodo de acción debe invocar un efecto externo (webhook, API de dominio).
// Ese ejecutor todavía no existe, así que el nodo NO se ejecuta: falla de forma
// explícita en lugar de simular un resultado.
//
// Antes este handler escribía en contexto un `config.mockResult` inventado, lo
// que hacía parecer que la acción se había ejecutado. Se retiró: el runtime real
// no finge integraciones.
// ---------------------------------------------------------------------------

export class ActionNodeHandler implements NodeHandler {
  public supports(nodeType: FlowNode["type"]): boolean {
    return nodeType === "action";
  }

  public execute(node: FlowNode, _input: RuntimeInput, _session: Session): NodeExecutionResult {
    return {
      executionStatus: "failed",
      outputMessages: [],
      contextPatch: {},
      nodeResult: {
        action: node.config.actionName ?? node.name,
        reason: "action_executor_not_implemented"
      },
      domainEvents: [`action_node_not_implemented:${node.id}`]
    };
  }
}
