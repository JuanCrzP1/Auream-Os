import type { BuilderFlowNode } from "@contracts/FlowSnapshot";
import { findTool } from "../tools/registry";

/**
 * Resumen de un nodo para su tarjeta.
 *
 * Delega en la herramienta cuando esta declara cómo se resume: es la única que
 * conoce la forma de su configuración. Lo que queda aquí es el apaño genérico
 * para las que todavía no lo declaran, y desaparecerá cuando todas lo hagan.
 */
export function summarizeNode(node: BuilderFlowNode): { preview: string; configSummary: string } {
  const propio = findTool(node.type)?.summarize;

  const preview = propio
    ? propio(node.content, node.config)
    : typeof node.content.text === "string"
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