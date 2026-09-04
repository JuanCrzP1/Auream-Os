import type { ToolUi } from "../ToolUi";
import { TagsIcon } from "./TagsIcon";

/** Mitad React de la herramienta. Único punto donde declara cómo se ve. */
export const tagsUi: ToolUi = {
  type: "tags",
  Icon: TagsIcon,
  frame: "circle"
};
