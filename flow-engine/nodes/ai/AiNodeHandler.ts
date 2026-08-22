import type { FlowNode } from "../../../contracts/FlowSnapshot";
import type { NodeExecutionResult, RuntimeInput } from "../../../contracts/RuntimeContracts";
import type { Session } from "../../../contracts/RuntimeContracts";
import type { NodeHandler } from "../NodeHandler";

// ---------------------------------------------------------------------------
// AiNodeHandler
//
// Estado: NO IMPLEMENTADO.
//
// El nodo de IA ejecutará un prompt contra un proveedor a través del puerto
// `flow-engine/ports/AiProvider.ts`. Ninguna implementación existe todavía y la
// cadena de ejecución es síncrona, por lo que el nodo no puede invocar el puerto.
//
// Falla de forma explícita en lugar de devolver éxito con un proveedor inventado.
//
// Un nodo de IA NO convierte el flow en un AI Agent: el flow sigue siendo
// determinístico. El motor conversacional de ventas es `ai-sales-engine/`.
// ---------------------------------------------------------------------------

export class AiNodeHandler implements NodeHandler {
  public supports(nodeType: FlowNode["type"]): boolean {
    return nodeType === "ai";
  }

  public execute(node: FlowNode, _input: RuntimeInput, _session: Session): NodeExecutionResult {
    return {
      executionStatus: "failed",
      outputMessages: [],
      contextPatch: {},
      nodeResult: {
        reason: "ai_provider_not_implemented"
      },
      domainEvents: [`ai_node_not_implemented:${node.id}`]
    };
  }
}
