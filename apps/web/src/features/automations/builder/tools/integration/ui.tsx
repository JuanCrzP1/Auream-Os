import type { ToolUi } from "../ToolUi";
import { IntegrationIcon } from "./IntegrationIcon";
import { IntegrationEditor } from "./IntegrationEditor";
import { createOutputsCompactBody } from "../_kit/OutputsCompactBody";
import { summarizeIntegration } from "./summarizeIntegration";

export const integrationUi: ToolUi = {
  type: "integration",
  Icon: IntegrationIcon,
  frame: "card",
  CompactBody: createOutputsCompactBody(summarizeIntegration),
  Editor: IntegrationEditor
};
