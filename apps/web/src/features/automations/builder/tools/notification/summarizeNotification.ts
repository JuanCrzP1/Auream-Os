import type { ToolData } from "../ToolDefinition";
import { readNotificationConfig } from "./notificationConfig";

export function summarizeNotification(_content: ToolData, config: ToolData): string {
  const { name, countryCode, phone } = readNotificationConfig(config);
  if (phone.length === 0) return "Sin destinatario";

  return `Avisar a ${name.trim() || "equipo"} · +${countryCode} ${phone}`;
}
