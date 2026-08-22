import type { FlowNode } from "../../contracts/FlowSnapshot";
import type { NodeExecutionResult, RuntimeInput } from "../../contracts/RuntimeContracts";
import type { Session } from "../../contracts/RuntimeContracts";
import type { NodeHandler } from "./NodeHandler";

export class NodeRuntime {
  public constructor(private readonly handlers: NodeHandler[]) {}

  public execute(node: FlowNode, input: RuntimeInput, session: Session): NodeExecutionResult {
    const handler = this.handlers.find((candidate) => candidate.supports(node.type));

    if (!handler) {
      throw new Error(`No existe handler para el nodo ${node.type}`);
    }

    return handler.execute(node, input, session);
  }
}