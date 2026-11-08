import type { ToolUi } from "../ToolUi";
import { TagsCompactBody } from "./TagsCompactBody";
import { TagsIcon } from "./TagsIcon";
import { TagsEditor } from "./TagsEditor";

export const tagsUi: ToolUi = {
  type: "tags",
  Icon: TagsIcon,
  frame: "circle",
  CompactBody: TagsCompactBody,
  Editor: TagsEditor
};
