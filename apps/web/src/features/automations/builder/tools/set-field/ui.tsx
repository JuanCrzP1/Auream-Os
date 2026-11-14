import type { ToolUi } from "../ToolUi";
import { SetFieldCompactBody } from "./SetFieldCompactBody";
import { SetFieldEditor } from "./SetFieldEditor";
import { SetFieldIcon } from "./SetFieldIcon";

export const setFieldUi: ToolUi = {
  type: "set-field",
  Icon: SetFieldIcon,
  frame: "circle",
  CompactBody: SetFieldCompactBody,
  Editor: SetFieldEditor
};
