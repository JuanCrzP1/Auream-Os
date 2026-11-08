import { readWaitResponseConfig, type WaitResponseConfig } from "@contracts/WaitResponseConfig";
import type { ToolData } from "../ToolDefinition";

/** «Sin límite», «1 minuto», «2 horas». */
export function describeWait(config: WaitResponseConfig): string {
  if (config.waitIndefinitely || !config.timeout) return "Sin límite";

  const { amount, unit } = config.timeout;
  const noun =
    unit === "hours" ? (amount === 1 ? "hora" : "horas") : amount === 1 ? "minuto" : "minutos";

  return `${amount} ${noun}`;
}

export function summarizeWaitResponse(_content: ToolData, config: ToolData): string {
  const read = readWaitResponseConfig(config);
  const wait = describeWait(read);

  return read.targetKey ? `${wait} · Guarda en ${read.targetKey}` : wait;
}
