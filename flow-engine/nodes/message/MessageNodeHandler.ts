import type { FlowNode } from "../../../contracts/FlowSnapshot";
import type { NodeExecutionResult, RuntimeInput } from "../../../contracts/RuntimeContracts";
import type { Session } from "../../../contracts/RuntimeContracts";
import type { NodeHandler } from "../NodeHandler";

export class MessageNodeHandler implements NodeHandler {
  public supports(nodeType: FlowNode["type"]): boolean {
    return nodeType === "message";
  }

  public execute(node: FlowNode, input: RuntimeInput, session: Session): NodeExecutionResult {
    const rawTemplate = String(node.content.text ?? "");
    const rendered = rawTemplate.replace(/{{\s*context\.([a-zA-Z0-9_]+)\s*}}/g, (_match, key) => {
      const value = session.context[key];
      return value == null ? "" : String(value);
    });

    return {
      executionStatus: "success",
      outputMessages: [
        {
          channel: input.envelope.channel,
          conversationKey: input.envelope.conversationKey,
          content: rendered
        }
      ],
      contextPatch: {},
      nodeResult: {},
      domainEvents: [`message_node_executed:${node.id}`]
    };
  }
}