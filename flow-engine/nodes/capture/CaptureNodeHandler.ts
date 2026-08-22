import type { FlowNode } from "../../../contracts/FlowSnapshot";
import type { NodeExecutionResult, RuntimeInput } from "../../../contracts/RuntimeContracts";
import type { Session } from "../../../contracts/RuntimeContracts";
import type { NodeHandler } from "../NodeHandler";

export class CaptureNodeHandler implements NodeHandler {
  public supports(nodeType: FlowNode["type"]): boolean {
    return nodeType === "capture";
  }

  public execute(node: FlowNode, input: RuntimeInput, _session: Session): NodeExecutionResult {
    const targetKey = String(node.config.targetKey ?? "captured_value");
    const inboundText = input.envelope.payload.text;

    return {
      executionStatus: "success",
      outputMessages: [],
      contextPatch: typeof inboundText === "string" ? { [targetKey]: inboundText } : {},
      nodeResult: {
        storedKey: targetKey
      },
      domainEvents: [`capture_node_executed:${node.id}`]
    };
  }
}