import type { ToolData } from "../ToolDefinition";
import { readIntegrationConfig } from "./integrationConfig";

export function summarizeIntegration(_content: ToolData, config: ToolData): string {
  const { method, url } = readIntegrationConfig(config);
  if (url.length === 0) return `${method} · sin URL`;

  const host = url.replace(/^https?:\/\//i, "").split(/[/?#]/)[0];
  return `${method} · ${host}`;
}
