import { blockOutputs } from "@contracts/blocks/blockCatalog";
import { isValidOutput } from "@contracts/blocks/connectionRules";
import type { ToolData, ToolOutput } from "../tools/ToolDefinition";
import type { CanvasNode } from "../types/canvas";

/**
 * Salidas de un nodo según su herramienta.
 *
 * `null` = el nodo tiene una única salida implícita (sin id de handle).
 * Lista  = el nodo tiene exactamente esas salidas con nombre.
 */
export function listNodeOutputs(type: string, config: ToolData): ReadonlyArray<ToolOutput> | null {
  return blockOutputs(type, config);
}

export function isValidSourceHandle(type: string, config: ToolData, sourceHandle: string | null | undefined): boolean {
  return isValidOutput(type, config, sourceHandle);
}

/**
 * Fija a la primera salida con nombre las aristas heredadas sin `sourceHandle`,
 * para que se guarden con `fromOutput` y no dependan del orden de los handles.
 */
export function assignLegacyOutputs<E extends EdgeShape>(
  nodes: ReadonlyArray<CanvasNode>,
  edges: E[]
): E[] {
  const byId = new Map(nodes.map((node) => [node.id, node]));

  return edges.map((edge) => {
    if (edge.sourceHandle) return edge;
    const source = byId.get(edge.source);
    if (!source || source.data.isEntry) return edge;
    const first = listNodeOutputs(source.data.nodeType, source.data.config)?.[0];
    return first ? { ...edge, sourceHandle: first.id } : edge;
  });
}

interface NodeShape {
  readonly id: string;
  readonly type: string;
  readonly config: ToolData;
  /** El nodo de entrada se pinta como píldora con una única salida implícita. */
  readonly isEntry?: boolean;
}

interface EdgeShape {
  readonly source: string;
  readonly target: string;
  readonly sourceHandle?: string | null;
}

/**
 * Descarta las aristas que ya no pueden existir: las que tocan un nodo borrado
 * y las que arrancan de una salida que la configuración del nodo ya no ofrece.
 *
 * Devuelve la MISMA lista si no hay nada que descartar, para que quien la use
 * en un `setState` no provoque un render innecesario.
 */
export function pruneInvalidEdges<E extends EdgeShape>(
  nodes: ReadonlyArray<NodeShape>,
  edges: E[]
): E[] {
  const byId = new Map(nodes.map((node) => [node.id, node]));

  const kept = edges.filter((edge) => {
    const source = byId.get(edge.source);
    if (!source || !byId.has(edge.target)) return false;
    if (source.isEntry) return !edge.sourceHandle;
    return isValidSourceHandle(source.type, source.config, edge.sourceHandle);
  });

  return kept.length === edges.length ? edges : kept;
}

/** `pruneInvalidEdges` sobre nodos del lienzo. */
export function pruneCanvasEdges<E extends EdgeShape>(
  nodes: ReadonlyArray<CanvasNode>,
  edges: E[]
): E[] {
  return pruneInvalidEdges(
    nodes.map((node) => ({
      id: node.id,
      type: node.data.nodeType,
      config: node.data.config,
      isEntry: node.data.isEntry
    })),
    edges
  );
}
