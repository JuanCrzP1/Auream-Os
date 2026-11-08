import type { ToolData } from "../ToolDefinition";
import { readMenuConfig } from "./menuConfig";

export function summarizeMenu(_content: ToolData, config: ToolData): string {
  const read = readMenuConfig(config);
  const message = read.message.replace(/\s+/g, " ").trim();
  return message.length > 0 ? message : read.format === "list" ? "Menú en lista" : "Menú con botones";
}
