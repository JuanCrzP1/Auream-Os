import type { FlowNode } from "../../../contracts/FlowSnapshot";
import type { NodeExecutionResult, RuntimeInput } from "../../../contracts/RuntimeContracts";
import type { Session } from "../../../contracts/RuntimeContracts";
import type { NodeHandler } from "../NodeHandler";

// ---------------------------------------------------------------------------
// PaymentProofNodeHandler
//
// Estado: NO IMPLEMENTADO — la herramienta existe en el catálogo y en el
// builder, pero su comportamiento de ejecución todavía no está especificado.
//
// Procesará un comprobante de pago recibido por el canal. Requiere almacenamiento de media y un extractor, ninguno definido todavía.
//
// Falla de forma explícita en lugar de devolver un resultado inventado: un flow
// que llegue a este nodo se detiene y lo dice. No se finge funcionalidad.
// ---------------------------------------------------------------------------

export class PaymentProofNodeHandler implements NodeHandler {
  public supports(nodeType: FlowNode["type"]): boolean {
    return nodeType === "payment-proof";
  }

  public execute(node: FlowNode, _input: RuntimeInput, _session: Session): NodeExecutionResult {
    return {
      executionStatus: "failed",
      outputMessages: [],
      contextPatch: {},
      nodeResult: {
        reason: "payment_proof_executor_not_implemented"
      },
      domainEvents: [`payment_proof_node_not_implemented:${node.id}`]
    };
  }
}
