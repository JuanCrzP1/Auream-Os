import type { NodeExecutionResult } from "@contracts/RuntimeContracts";
import { requestBuilderApi } from "./requestBuilderApi";

export async function simulateBuilderWorkspace(
  flowKey: string,
  message: string,
  conversationKey: string,
  userKey: string
): Promise<NodeExecutionResult> {
  return requestBuilderApi<NodeExecutionResult>(`/api/builder/flows/${flowKey}/simulate`, {
    method: "POST",
    body: JSON.stringify({ message, conversationKey, userKey })
  });
}