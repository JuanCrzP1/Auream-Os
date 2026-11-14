import type { ToolUi } from "../ToolUi";
import { GoToFlowCompactBody } from "./GoToFlowCompactBody";
import { GoToFlowEditor } from "./GoToFlowEditor";
import { GoToFlowIcon } from "./GoToFlowIcon";

export const goToFlowUi: ToolUi = {
  type: "go-to-flow",
  Icon: GoToFlowIcon,
  frame: "circle",
  CompactBody: GoToFlowCompactBody,
  Editor: GoToFlowEditor
};
