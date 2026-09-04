import type { CanvasNode } from "../types/canvas";
import { clonePlainData } from "./clonePlainData";
import { resolveTool } from "../tools/registry";

// ---------------------------------------------------------------------------
// Duplicado de un nodo del lienzo.
//
// Copia TODO lo que el usuario configuró y renueva solo lo que no puede
// repetirse: la identidad del nodo y su sitio en el lienzo.
//
// La copia de la configuración la delega en la herramienta cuando esta declara
// cómo hacerla. Solo ella sabe si dentro de su `config` hay identidades que
// convenga renovar —los bloques de un Mensaje— o si es contenido plano que se
// copia tal cual, que es el caso de casi todas.
// ---------------------------------------------------------------------------

/** Desplazamiento de la copia. Múltiplo de la rejilla de 24px del lienzo. */
const OFFSET = 48;

/**
 * Devuelve una copia del nodo, lista para añadirse al lienzo.
 *
 * @param index Posición en la lista de nodos, solo para componer un id único.
 */
export function duplicateNodeDraft(node: CanvasNode, index: number): CanvasNode {
  const tool = resolveTool(node.data.nodeType);

  const position = {
    x: node.position.x + OFFSET,
    y: node.position.y + OFFSET
  };

  const config = tool.duplicateConfig
    ? tool.duplicateConfig(node.data.config)
    : clonePlainData(node.data.config);

  return {
    ...node,
    id: `${node.data.nodeType}-${Date.now()}-${index}`,
    position,
    // La copia nunca hereda la protección ni la condición de entrada: solo
    // puede haber un nodo de entrada, y es el original.
    deletable: true,
    selected: false,
    data: {
      ...node.data,
      isEntry: false,
      isExpanded: false,
      content: clonePlainData(node.data.content),
      config,
      // La posición viaja en los metadatos porque es lo que se serializa; si no
      // se actualizara aquí, la copia se dibujaría desplazada y se guardaría
      // encima del original.
      metadata: { ...clonePlainData(node.data.metadata), ui: { ...position } }
    }
  };
}
