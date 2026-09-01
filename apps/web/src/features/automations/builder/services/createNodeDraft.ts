import type { CanvasNode } from "../types/canvas";
import type { NodeType } from "@contracts/FlowSnapshot";
import { resolveTool } from "../tools/registry";

/**
 * Crea un nodo nuevo para el canvas a partir de la definición de su herramienta.
 *
 * Las etiquetas y textos por defecto los declara cada módulo de herramienta:
 * este archivo solo construye la forma que el canvas necesita.
 */
export function createNodeDraft(nodeType: NodeType, index: number): CanvasNode {
  const tool = resolveTool(nodeType);

  const position = {
    x: 240 + index * 36,
    y: 260 + (index % 3) * 120
  };

  const id = `${nodeType}-${Date.now()}-${index}`;

  return {
    id,
    type: "flowNode",
    position,
    data: {
      nodeType,
      title: tool.label,
      preview: tool.defaultContentText,
      configSummary: "Pendiente de configurar",
      isEntry: false,
      isTerminal: tool.terminal,
      content: { text: tool.defaultContentText },
      // Copia superficial: dos nodos de la misma herramienta no deben compartir
      // el objeto de configuración declarado en su definición.
      config: { ...tool.defaultConfig },
      metadata: { ui: position }
    }
  };
}
