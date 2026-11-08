import type { ToolUi } from "../ToolUi";
import { PixelCompactBody } from "./PixelCompactBody";
import { PixelIcon } from "./PixelIcon";
import { PixelEditor } from "./PixelEditor";

export const pixelUi: ToolUi = {
  type: "pixel",
  Icon: PixelIcon,
  frame: "circle",
  CompactBody: PixelCompactBody,
  Editor: PixelEditor
};
