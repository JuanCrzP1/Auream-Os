import type { ToolUi } from "../ToolUi";
import { ConditionalIcon } from "./ConditionalIcon";
import { ConditionEditor } from "./ConditionEditor";
import { createOutputsCompactBody } from "../_kit/OutputsCompactBody";
import { summarizeCondition } from "./summarizeCondition";

export const conditionalUi: ToolUi = {
  type: "condition",
  Icon: ConditionalIcon,
  frame: "diamond",
  CompactBody: createOutputsCompactBody(summarizeCondition),
  Editor: ConditionEditor
};
