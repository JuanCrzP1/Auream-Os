import type { FlowNode } from "../../../contracts/FlowSnapshot";
import type { NodeExecutionResult, RuntimeInput } from "../../../contracts/RuntimeContracts";
import type { Session } from "../../../contracts/RuntimeContracts";
import type { NodeHandler } from "../NodeHandler";

// ---------------------------------------------------------------------------
// SaleApprovedNodeHandler
//
// Estado: NO IMPLEMENTADO — la herramienta existe en el catálogo y en el
// builder, pero su comportamiento de ejecución todavía no está especificado.
//
// Marcará la conversación como venta cerrada. El modelo de venta y su persistencia no están definidos.
//
// Falla de forma explícita en lugar de devolver un resultado inventado: un flow
// que llegue a este nodo se detiene y lo dice. No se finge funcionalidad.
// ---------------------------------------------------------------------------

export class SaleApprovedNodeHandler implements NodeHandler {
  public supports(nodeType: FlowNode["type"]): boolean {
    return nodeType === "sale-approved";
  }

  public execute(node: FlowNode, _input: RuntimeInput, _session: Session): NodeExecutionResult {
    return {
      executionStatus: "failed",
      outputMessages: [],
      contextPatch: {},
      nodeResult: {
        reason: "sale_approved_executor_not_implemented"
      },
      domainEvents: [`sale_approved_node_not_implemented:${node.id}`]
    };
  }
}
