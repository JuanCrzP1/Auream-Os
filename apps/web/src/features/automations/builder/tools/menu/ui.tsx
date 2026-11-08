import type { ToolUi } from "../ToolUi";
import { MenuIcon } from "./MenuIcon";
import { MenuEditor } from "./MenuEditor";
import { createOutputsCompactBody } from "../_kit/OutputsCompactBody";
import { summarizeMenu } from "./summarizeMenu";

export const menuUi: ToolUi = {
  type: "menu",
  Icon: MenuIcon,
  frame: "card",
  CompactBody: createOutputsCompactBody(summarizeMenu),
  Editor: MenuEditor
};
