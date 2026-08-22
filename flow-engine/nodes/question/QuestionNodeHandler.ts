import type { FlowNode } from "../../../contracts/FlowSnapshot";
import type { NodeExecutionResult, RuntimeInput } from "../../../contracts/RuntimeContracts";
import type { Session } from "../../../contracts/RuntimeContracts";
import type { NodeHandler } from "../NodeHandler";

export class QuestionNodeHandler implements NodeHandler {
  public supports(nodeType: FlowNode["type"]): boolean {
    return nodeType === "question";
  }

  public execute(node: FlowNode, input: RuntimeInput, _session: Session): NodeExecutionResult {
    const inboundText = input.envelope.payload.text;

    if (input.isWaitingInput && typeof inboundText === "string" && inboundText.length > 0) {
      return {
        executionStatus: "success",
        outputMessages: [],
        contextPatch: {},
        nodeResult: {
          capturedInput: inboundText
        },
        domainEvents: [`question_answered:${node.id}`]
      };
    }

    return {
      executionStatus: "waiting_input",
      outputMessages: [
        {
          channel: input.envelope.channel,
          conversationKey: input.envelope.conversationKey,
          content: String(node.content.text ?? "")
        }
      ],
      contextPatch: {},
      nodeResult: {},
      domainEvents: [`question_prompted:${node.id}`]
    };
  }
}