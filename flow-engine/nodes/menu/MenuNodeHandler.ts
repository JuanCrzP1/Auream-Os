import type { FlowNode } from "../../../contracts/FlowSnapshot";
import type { NodeExecutionResult, RuntimeInput } from "../../../contracts/RuntimeContracts";
import type { Session } from "../../../contracts/RuntimeContracts";
import type { NodeHandler } from "../NodeHandler";

// ---------------------------------------------------------------------------
// MenuNodeHandler
//
// Estado: NO IMPLEMENTADO — la herramienta existe en el catálogo y en el
// builder, pero su comportamiento de ejecución todavía no está especificado.
//
// Ofrecerá un conjunto de opciones y esperará la elección del usuario. La forma de las opciones y su enrutado a edges no está especificada.
//
// Falla de forma explícita en lugar de devolver un resultado inventado: un flow
// que llegue a este nodo se detiene y lo dice. No se finge funcionalidad.
// ---------------------------------------------------------------------------

export class MenuNodeHandler implements NodeHandler {
  public supports(nodeType: FlowNode["type"]): boolean {
    return nodeType === "menu";
  }

  public execute(node: FlowNode, _input: RuntimeInput, _session: Session): NodeExecutionResult {
    return {
      executionStatus: "failed",
      outputMessages: [],
      contextPatch: {},
      nodeResult: {
        reason: "menu_executor_not_implemented"
      },
      domainEvents: [`menu_node_not_implemented:${node.id}`]
    };
  }
}
