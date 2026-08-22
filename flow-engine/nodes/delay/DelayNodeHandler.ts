import type { FlowNode } from "../../../contracts/FlowSnapshot";
import type { NodeExecutionResult, RuntimeInput } from "../../../contracts/RuntimeContracts";
import type { Session } from "../../../contracts/RuntimeContracts";
import type { NodeHandler } from "../NodeHandler";

export class DelayNodeHandler implements NodeHandler {
  public supports(nodeType: FlowNode["type"]): boolean {
    return nodeType === "delay";
  }

  public execute(node: FlowNode, input: RuntimeInput, _session: Session): NodeExecutionResult {
    return {
      executionStatus: "delayed",
      outputMessages: node.content.text
        ? [
            {
              channel: input.envelope.channel,
              conversationKey: input.envelope.conversationKey,
              content: String(node.content.text)
            }
          ]
        : [],
      contextPatch: {},
      nodeResult: {
        resumeAt: node.config.resumeAt ?? node.config.delayMs ?? null
      },
      domainEvents: [`delay_node_scheduled:${node.id}`]
    };
  }
}