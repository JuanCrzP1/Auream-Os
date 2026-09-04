import type { CanvasNode } from "../types/canvas";
import { clonePlainData } from "./clonePlainData";
import { summarizeNode } from "./summarizeNode";

// ---------------------------------------------------------------------------
// Mutador genérico de un nodo del lienzo.
//
// Es el ÚNICO camino de escritura sobre un nodo. Antes lo era
// `updateSelectedNode(field: "title" | "preview")`, una firma que enumeraba dos
// campos de texto: mientras existió, ninguna herramienta pudo escribir su
// configuración y `config` quedaba `{}` para siempre en todo nodo creado desde
// la interfaz.
//
// NO SABE NADA DE HERRAMIENTAS. No mira el tipo del nodo ni el contenido de la
// configuración: solo aplica datos. Qué configuración acepta cada herramienta y
// cómo se valida es responsabilidad de la herramienta, no de este archivo.
//
// SEMÁNTICA DEL PARCHE
//
//   - Campo ausente  → no se toca.
//   - Campo presente → REEMPLAZA el valor entero, no lo fusiona.
//
// El reemplazo es deliberado: el editor de una herramienta es dueño de su
// `content` y su `config` completos y entrega el valor final. Fusionar en
// profundidad haría imposible BORRAR una clave —quitar una opción de una lista,
// retirar un ajuste— porque la ausencia sería indistinguible de «no lo toques».
//
// `name` viaja con el vocabulario del modelo (`BuilderFlowNode.name`), no con
// el de la presentación (`data.title`); la traducción entre ambos ocurre aquí,
// que es donde ya vive la frontera.
// ---------------------------------------------------------------------------

/** Cambios que una herramienta puede pedir sobre un nodo. */
export interface NodePatch {
  readonly name?: string;
  readonly content?: Record<string, unknown>;
  readonly config?: Record<string, unknown>;
}

/**
 * Devuelve un nodo nuevo con el parche aplicado.
 *
 * `id`, `type`, `position`, `metadata`, `deletable` y el resto de banderas del
 * lienzo (`isEntry`, `isTerminal`, `nodeType`) se conservan intactos: este
 * mutador edita la intención del usuario, no la identidad del nodo ni su
 * colocación.
 *
 * `preview` y `configSummary` se recalculan, no se reciben: son presentación
 * derivada del contenido. Antes solo se calculaban al cargar el flujo, así que
 * el resumen de configuración de la tarjeta se quedaba obsoleto en cuanto se
 * editaba algo.
 */
export function applyNodePatch(node: CanvasNode, patch: NodePatch): CanvasNode {
  const title = patch.name ?? node.data.title;
  const content = patch.content ? clonePlainData(patch.content) : node.data.content;
  const config = patch.config ? clonePlainData(patch.config) : node.data.config;

  const { preview, configSummary } = summarizeNode({
    id: node.id,
    type: node.data.nodeType,
    name: title,
    content,
    config,
    metadata: node.data.metadata
  });

  return {
    ...node,
    data: {
      ...node.data,
      title,
      content,
      config,
      preview,
      configSummary
    }
  };
}
