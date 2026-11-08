import type { ToolUi } from "../ToolUi";
import { MessageIcon } from "./MessageIcon";
import { MessageEditor } from "./MessageEditor";
import { MessageCompactBody } from "./MessageCompactBody";

export const messageUi: ToolUi = {
  type: "message",
  Icon: MessageIcon,
  frame: "card",
  CompactBody: MessageCompactBody,
  Editor: MessageEditor
};
