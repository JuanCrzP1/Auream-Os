import type { CanvasNode } from "../types/canvas";
import { resolveTool } from "../tools/registry";

// ---------------------------------------------------------------------------
// Liberación de lo que un nodo tenía reservado fuera de su configuración.
//
// Espejo de `duplicateNodeDraft`: aquel pregunta a la herramienta qué copiar,
// este le pregunta qué soltar. Los dos existen por el mismo motivo —solo la
// herramienta sabe lo que hay dentro de su `config`— y los dos dejan al lienzo
// sin un solo `if` por tipo de nodo.
//
// SE LLAMA ANTES DE BORRAR, no después: una vez fuera de la lista, nadie puede
// mirar ya lo que el nodo llevaba dentro.
//
// Una herramienta que no declare nada no paga nada: la inmensa mayoría no
// reserva más que su configuración, y borrar el nodo ya la suelta.
// ---------------------------------------------------------------------------

/** Avisa a la herramienta del nodo de que va a desaparecer. */
export function releaseNodeResources(node: CanvasNode): void {
  resolveTool(node.data.nodeType).releaseResources?.(node.data.config);
}
