import type { CanvasNode } from "../types/canvas";
import type { NodeType } from "@contracts/FlowSnapshot";
import { resolveTool } from "../tools/registry";
import { clonePlainData } from "./clonePlainData";

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
      // Copia profunda por la misma razón que la configuración: si la
      // herramienta declara un contenido inicial con estructura, dos nodos no
      // pueden compartirlo.
      content: clonePlainData(tool.defaultContent ?? { text: tool.defaultContentText }),
      // Copia PROFUNDA. La definición de una herramienta se declara una vez, en
      // el ámbito del módulo, y vive lo que vive la pestaña: un nodo que se
      // quedara con una referencia a esa estructura convertiría el registry en
      // estado mutable compartido. Con copia superficial pasaba exactamente
      // eso — `tags` declara `{ tags: [] }` y `menu` declara `{ options: [] }`,
      // y ese array anidado era el MISMO objeto en la definición y en todos los
      // nodos creados a partir de ella: añadir una etiqueta a un nodo la añadía
      // a todos los que se arrastraran después, hasta recargar la página.
      config: clonePlainData(tool.defaultConfig),
      // Copia también aquí: `position` y `metadata.ui` describen lo mismo pero
      // tienen dueños distintos —el lienzo mueve la primera, la serialización
      // lee la segunda— y compartir el objeto ata dos ciclos de vida que deben
      // poder divergir.
      metadata: { ui: { ...position } }
    }
  };
}
