import type { CanvasNode } from "../types/canvas";
import type { NodeType } from "@contracts/FlowSnapshot";

const labelsByType: Record<NodeType, string> = {
  message: "Mensaje",
  question: "Esperar respuesta",
  capture: "Captura",
  action: "Acción",
  condition: "Condicional",
  delay: "Intervalo",
  fallback: "Fallback",
  end: "Finalizar",
  ai: "Extensión"
};

const previewsByType: Record<NodeType, string> = {
  message: "Mensaje al usuario",
  question: "Pregunta esperando input",
  capture: "Captura variable de contexto",
  action: "Webhook o API de dominio",
  condition: "Preprocesamiento y flags",
  delay: "Reanudar más tarde",
  fallback: "Recuperación de entrada",
  end: "Cerrar rama del flujo",
  ai: "Nodo encapsulado opcional"
};

export function createNodeDraft(nodeType: NodeType, index: number): CanvasNode {
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
      title: labelsByType[nodeType],
      preview: previewsByType[nodeType],
      configSummary: "Pendiente de configurar",
      isEntry: false,
      isTerminal: nodeType === "end",
      content: { text: previewsByType[nodeType] },
      config: {},
      metadata: { ui: position }
    }
  };
}