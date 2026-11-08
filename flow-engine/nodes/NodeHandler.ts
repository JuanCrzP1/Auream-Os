import type { FlowNode, NodeType } from "../../contracts/FlowSnapshot";
import type { NodeExecutionResult, RuntimeInput } from "../../contracts/RuntimeContracts";
import type { Session } from "../../contracts/RuntimeContracts";

/**
 * Ejecuta un tipo de bloque. Asíncrono (FASE C5): un bloque puede llamar a una
 * API, a un proveedor de IA o a la base de datos antes de decidir su salida.
 */
export interface NodeHandler {
  supports(nodeType: NodeType): boolean;
  execute(node: FlowNode, input: RuntimeInput, session: Session): Promise<NodeExecutionResult>;
}