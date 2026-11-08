import type { ToolData } from "../ToolDefinition";
import { PIXEL_EVENT_LABELS, readPixelConfig } from "./pixelConfig";

export function summarizePixel(_content: ToolData, config: ToolData): string {
  const read = readPixelConfig(config);
  const event = PIXEL_EVENT_LABELS[read.event];

  return read.event === "purchase" && read.value.trim()
    ? `Meta · ${event} · ${read.value.trim()} ${read.currency}`
    : `Meta · ${event}`;
}
