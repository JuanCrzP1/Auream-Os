import type { ToolData } from "../ToolDefinition";
import { readEnum, readStringList } from "../_kit/read";

export type TagsAction = "add" | "remove";

/** Una acción por nodo; todas las etiquetas en la misma lista. */
export interface TagsConfig {
  readonly action: TagsAction;
  readonly tags: ReadonlyArray<string>;
}

export const TAGS_DEFAULT_CONFIG: TagsConfig = { action: "add", tags: [] };

export function readTagsConfig(config: ToolData): TagsConfig {
  return {
    action: readEnum(config.action, ["add", "remove"] as const, "add"),
    tags: readStringList(config.tags)
  };
}
