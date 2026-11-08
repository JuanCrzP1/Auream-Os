import type { ToolUi } from "../ToolUi";
import { WaitResponseIcon } from "./WaitResponseIcon";
import { WaitResponseEditor } from "./WaitResponseEditor";
import { WaitResponseCompactBody } from "./WaitResponseCompactBody";

export const waitResponseUi: ToolUi = {
  type: "question",
  Icon: WaitResponseIcon,
  frame: "card",
  CompactBody: WaitResponseCompactBody,
  Editor: WaitResponseEditor
};
