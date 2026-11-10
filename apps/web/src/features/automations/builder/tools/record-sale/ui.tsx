import type { ToolUi } from "../ToolUi";
import { RecordSaleCompactBody } from "./RecordSaleCompactBody";
import { RecordSaleEditor } from "./RecordSaleEditor";
import { RecordSaleIcon } from "./RecordSaleIcon";

export const recordSaleUi: ToolUi = {
  type: "record-sale",
  Icon: RecordSaleIcon,
  frame: "circle",
  CompactBody: RecordSaleCompactBody,
  Editor: RecordSaleEditor
};
