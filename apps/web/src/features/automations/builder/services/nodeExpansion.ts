import type { CanvasNode } from "../types/canvas";

// ---------------------------------------------------------------------------
// Expansión de un nodo del lienzo.
//
// «Expandido» ya NO significa que el nodo de React Flow crezca: el nodo sigue
// siendo el compacto de siempre, con sus handles en su sitio de siempre. Lo
// que cambia es que aparece, flotando sobre el lienzo, el editor grande de la
// herramienta —`ExpandedNodeOverlay` lo monta, anclado a este mismo nodo—.
// Antes SÍ era el propio nodo el que se sustituía por el editor, y por eso
// existía un `dragHandle` que acotaba el arrastre a su cabecera; ya no hace
// falta —el nodo compacto se arrastra igual esté o no abierto su editor—, y
// dejarlo habría sido un bug real: un selector que ya no existe dentro del
// nodo deja el nodo entero sin poder arrastrarse.
//
// DÓNDE VIVE Y POR QUÉ
//
//   - En `data`, no en `metadata`: `metadata` se serializa, y el snapshot debe
//     conservar la intención del usuario, no el estado de su viewport. Un flujo
//     no se guarda «con el nodo 3 abierto».
//   - En `data`, no en un contexto de React: el valor de un contexto lo
//     consumen TODAS las tarjetas, así que abrir un nodo repintaría el lienzo
//     entero. Es justo el coste que `BuilderEditingContext` se escribió para
//     evitar.
//
// Al vivir en `data`, React Flow compara por referencia y solo se repintan los
// nodos cuyo objeto cambia: al abrir uno, exactamente dos —el que se abre y el
// que se cerraba—. Por eso estas funciones devuelven la MISMA referencia para
// todo nodo que no cambia; hacerlo con un `map` ciego repintaría el lienzo.
//
// INVARIANTE: como mucho un nodo expandido a la vez.
// ---------------------------------------------------------------------------

/** Capa del nodo abierto: por encima de sus vecinos, que si no lo tapan. */
const EXPANDED_Z_INDEX = 10;

function withExpansion(node: CanvasNode, expanded: boolean): CanvasNode {
  if (Boolean(node.data.isExpanded) === expanded) return node;

  return {
    ...node,
    zIndex: expanded ? EXPANDED_Z_INDEX : undefined,
    data: { ...node.data, isExpanded: expanded }
  };
}

/**
 * Abre un nodo y cierra cualquier otro.
 *
 * Conmuta: pedir la apertura del que ya está abierto lo cierra, para que el
 * mismo control sirva en los dos sentidos.
 */
export function toggleNodeExpansion(
  nodes: ReadonlyArray<CanvasNode>,
  nodeId: string
): CanvasNode[] {
  const yaAbierto = nodes.some((node) => node.id === nodeId && node.data.isExpanded);

  return nodes.map((node) => withExpansion(node, !yaAbierto && node.id === nodeId));
}

/** Cierra todos. */
export function collapseAllNodes(nodes: ReadonlyArray<CanvasNode>): CanvasNode[] {
  return nodes.map((node) => withExpansion(node, false));
}

/** Id del nodo abierto, o `null`. */
export function findExpandedNodeId(nodes: ReadonlyArray<CanvasNode>): string | null {
  return nodes.find((node) => node.data.isExpanded)?.id ?? null;
}
