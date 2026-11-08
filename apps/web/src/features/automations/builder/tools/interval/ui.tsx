import type { ToolUi } from "../ToolUi";
import { IntervalIcon } from "./IntervalIcon";
import { IntervalEditor } from "./IntervalEditor";
import { IntervalCompactBody } from "./IntervalCompactBody";

export const intervalUi: ToolUi = {
  type: "delay",
  Icon: IntervalIcon,
  frame: "circle",
  CompactBody: IntervalCompactBody,
  Editor: IntervalEditor
};
