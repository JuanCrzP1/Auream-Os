import type { ToolUi } from "../ToolUi";
import { DistributorIcon } from "./DistributorIcon";
import { DistributorEditor } from "./DistributorEditor";
import { DistributorCompactBody } from "./DistributorCompactBody";

export const distributorUi: ToolUi = {
  type: "distributor",
  Icon: DistributorIcon,
  frame: "diamond",
  CompactBody: DistributorCompactBody,
  Editor: DistributorEditor
};
