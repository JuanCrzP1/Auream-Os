// La forma de un mensaje es el contrato compartido con el motor
// (`contracts/MessageConfig.ts`): el editor y la ejecución leen lo mismo.
export type {
  MessageIntervalItem,
  MessageIntervalUnit,
  MessageItem,
  MessageItemKind,
  MessageMediaItem,
  MessageMediaKind,
  MessageTextItem
} from "@contracts/MessageConfig";
import type { MessageItem } from "@contracts/MessageConfig";

export interface MessageConfig {
  readonly items: ReadonlyArray<MessageItem>;
}
