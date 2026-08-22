import type { FlowNode, NodeType } from "../../contracts/FlowSnapshot";
import type { NodeExecutionResult, RuntimeInput } from "../../contracts/RuntimeContracts";
import type { Session } from "../../contracts/RuntimeContracts";

export interface NodeHandler {
  supports(nodeType: NodeType): boolean;
  execute(node: FlowNode, input: RuntimeInput, session: Session): NodeExecutionResult;
}