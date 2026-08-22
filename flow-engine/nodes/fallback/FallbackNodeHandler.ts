import type { FlowNode } from "../../../contracts/FlowSnapshot";
import type { NodeExecutionResult, RuntimeInput } from "../../../contracts/RuntimeContracts";
import type { Session } from "../../../contracts/RuntimeContracts";
import type { NodeHandler } from "../NodeHandler";

export class FallbackNodeHandler implements NodeHandler {
  public supports(nodeType: FlowNode["type"]): boolean {
    return nodeType === "fallback";
  }

  public execute(node: FlowNode, input: RuntimeInput, _session: Session): NodeExecutionResult {
    return {
      executionStatus: "waiting_input",
      outputMessages: [
        {
          channel: input.envelope.channel,
          conversationKey: input.envelope.conversationKey,
          content: String(node.content.text ?? "No entendí la respuesta. Intentá de nuevo.")
        }
      ],
      contextPatch: {},
      nodeResult: {},
      domainEvents: [`fallback_node_executed:${node.id}`]
    };
  }
}