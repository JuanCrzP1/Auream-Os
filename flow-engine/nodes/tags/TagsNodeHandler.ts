import type { FlowNode } from "../../../contracts/FlowSnapshot";
import type { NodeExecutionResult, RuntimeInput } from "../../../contracts/RuntimeContracts";
import type { Session } from "../../../contracts/RuntimeContracts";
import type { NodeHandler } from "../NodeHandler";

// ---------------------------------------------------------------------------
// TagsNodeHandler
//
// Estado: NO IMPLEMENTADO — la herramienta existe en el catálogo y en el
// builder, pero su comportamiento de ejecución todavía no está especificado.
//
// Aplicará o retirará etiquetas sobre el contacto de la conversación. Requiere el dominio `contacts`, que todavía no existe.
//
// Falla de forma explícita en lugar de devolver un resultado inventado: un flow
// que llegue a este nodo se detiene y lo dice. No se finge funcionalidad.
// ---------------------------------------------------------------------------

export class TagsNodeHandler implements NodeHandler {
  public supports(nodeType: FlowNode["type"]): boolean {
    return nodeType === "tags";
  }

  public execute(node: FlowNode, _input: RuntimeInput, _session: Session): NodeExecutionResult {
    return {
      executionStatus: "failed",
      outputMessages: [],
      contextPatch: {},
      nodeResult: {
        reason: "tags_executor_not_implemented"
      },
      domainEvents: [`tags_node_not_implemented:${node.id}`]
    };
  }
}
