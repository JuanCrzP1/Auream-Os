import type { CanvasNode } from "../types/canvas";

// ---------------------------------------------------------------------------
// Expansión de un nodo del lienzo.
//
// Un nodo expandido es EL MISMO nodo, más grande: conserva su id, su posición,
// su selección y sus conexiones. No es una ventana aparte, y por eso el estado
// de apertura vive en el propio nodo.
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

/**
 * Selector del área por la que se arrastra un nodo expandido.
 *
 * Sin esto, arrastrar para seleccionar texto dentro de un campo movería el nodo
 * por el lienzo. React Flow acota el gesto de arrastre a este selector, y el
 * resto del cuerpo queda libre para el contenido.
 */
export const EXPANDED_DRAG_HANDLE = ".node-expanded__header";

/** Capa del nodo abierto: por encima de sus vecinos, que si no lo tapan. */
const EXPANDED_Z_INDEX = 10;

function withExpansion(node: CanvasNode, expanded: boolean): CanvasNode {
  if (Boolean(node.data.isExpanded) === expanded) return node;

  return {
    ...node,
    // `dragHandle` solo mientras está abierto: en compacto se arrastra el nodo
    // entero, que es lo que el usuario espera de una tarjeta.
    dragHandle: expanded ? EXPANDED_DRAG_HANDLE : undefined,
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
