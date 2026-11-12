import type { ConversationSummary } from "@contracts/ConversationContracts";
import { formatPhone } from "@shared/phone/formatPhone";

/** El nombre del cliente, o su número si no lo sabemos. */
export function displayName(conversation: Pick<ConversationSummary, "contactName" | "phone">): string {
  return conversation.contactName?.trim() || formatPhone(conversation.phone).text;
}
