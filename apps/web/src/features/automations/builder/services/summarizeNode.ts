import type { BuilderFlowNode } from "@contracts/FlowSnapshot";

export function summarizeNode(node: BuilderFlowNode): { preview: string; configSummary: string } {
  const preview = typeof node.content.text === "string"
    ? node.content.text
    : typeof node.config.targetKey === "string"
      ? `Guarda en ${node.config.targetKey}`
      : `Nodo ${node.type}`;

  const configSummary = Object.keys(node.config).length === 0
    ? "Sin configuración adicional"
    : Object.entries(node.config)
        .map(([key, value]) => `${key}: ${String(value)}`)
        .join(" · ");

  return { preview, configSummary };
}