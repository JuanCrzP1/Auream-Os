import type { FlowNode } from "../../../contracts/FlowSnapshot";
import type { NodeExecutionResult, RuntimeInput } from "../../../contracts/RuntimeContracts";
import type { Session } from "../../../contracts/RuntimeContracts";
import type { NodeHandler } from "../NodeHandler";

export class EndNodeHandler implements NodeHandler {
  public supports(nodeType: FlowNode["type"]): boolean {
    return nodeType === "end";
  }

  public execute(node: FlowNode, input: RuntimeInput, session: Session): NodeExecutionResult {
    const template = String(node.content.text ?? "Flujo finalizado");
    const rendered = template.replace(/{{\s*context\.([a-zA-Z0-9_]+)\s*}}/g, (_match, key) => {
      const value = session.context[key];
      return value == null ? "" : String(value);
    });

    return {
      executionStatus: "completed",
      outputMessages: [
        {
          channel: input.envelope.channel,
          conversationKey: input.envelope.conversationKey,
          content: rendered
        }
      ],
      contextPatch: {},
      nodeResult: {},
      domainEvents: [`end_node_executed:${node.id}`]
    };
  }
}