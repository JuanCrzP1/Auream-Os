import type { FlowNode } from "../../../contracts/FlowSnapshot";
import type { NodeExecutionResult, RuntimeInput } from "../../../contracts/RuntimeContracts";
import type { Session } from "../../../contracts/RuntimeContracts";
import type { NodeHandler } from "../NodeHandler";

// ---------------------------------------------------------------------------
// DistributorNodeHandler
//
// Estado: NO IMPLEMENTADO — la herramienta existe en el catálogo y en el
// builder, pero su comportamiento de ejecución todavía no está especificado.
//
// Repartirá la conversación entre varias rutas o destinatarios. La política de reparto (round-robin, peso, sticky) no está decidida.
//
// Falla de forma explícita en lugar de devolver un resultado inventado: un flow
// que llegue a este nodo se detiene y lo dice. No se finge funcionalidad.
// ---------------------------------------------------------------------------

export class DistributorNodeHandler implements NodeHandler {
  public supports(nodeType: FlowNode["type"]): boolean {
    return nodeType === "distributor";
  }

  public execute(node: FlowNode, _input: RuntimeInput, _session: Session): NodeExecutionResult {
    return {
      executionStatus: "failed",
      outputMessages: [],
      contextPatch: {},
      nodeResult: {
        reason: "distributor_executor_not_implemented"
      },
      domainEvents: [`distributor_node_not_implemented:${node.id}`]
    };
  }
}
