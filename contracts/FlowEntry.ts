import type { BuilderFlowEdge, BuilderFlowNode, BuilderFlowSnapshot } from "./FlowSnapshot";

// ---------------------------------------------------------------------------
// Bloque de inicio («Inicio», tipo `start`).
//
// Nodo de SISTEMA: todo flujo tiene exactamente uno, es su `entryNodeId`, no se
// crea desde la paleta, no se borra, no hace nada y tiene una sola salida.
// Es el punto donde vivirán los disparadores del flujo.
//
// Antes el inicio era un nodo `message` con el texto «Inicio del flujo»: al
// ejecutarse le habría ENVIADO ese texto a cada cliente. `ensureStartEntry`
// migra esos flujos al leerlos. Ver docs/architecture/flow-connections.md.
// ---------------------------------------------------------------------------

export const START_NODE_TYPE = "start";

export const START_NODE_NAME = "Inicio";

/** Id del inicio en los flujos nuevos. */
export const START_NODE_ID = "start";

/** Posición del inicio en un flujo nuevo o reparado. */
const DEFAULT_POSITION = { x: 200, y: 220 } as const;

/** Distancia horizontal al insertar el inicio delante de un bloque existente. */
const INSERT_OFFSET_X = 260;

/** Texto con el que se sembraba el antiguo inicio de tipo `message`. */
const LEGACY_SEED_TEXT = "Inicio del flujo";

export function createStartNode(
  id: string = START_NODE_ID,
  position: { readonly x: number; readonly y: number } = DEFAULT_POSITION
): BuilderFlowNode {
  return {
    id,
    type: START_NODE_TYPE,
    name: START_NODE_NAME,
    content: {},
    config: {},
    metadata: { ui: { x: position.x, y: position.y } }
  };
}

/** ¿Es el antiguo inicio sembrado (un `message` que solo decía «Inicio del flujo»)? */
function isLegacySeed(node: BuilderFlowNode): boolean {
  const items = node.config.items;
  return (
    node.type === "message" &&
    node.content.text === LEGACY_SEED_TEXT &&
    (items === undefined || (Array.isArray(items) && items.length === 0))
  );
}

function readPosition(node: BuilderFlowNode): { x: number; y: number } {
  const ui = node.metadata.ui as { x?: unknown; y?: unknown } | undefined;
  return {
    x: typeof ui?.x === "number" ? ui.x : DEFAULT_POSITION.x,
    y: typeof ui?.y === "number" ? ui.y : DEFAULT_POSITION.y
  };
}

function freeId(nodes: Readonly<Record<string, BuilderFlowNode>>): string {
  let id = START_NODE_ID;
  for (let n = 2; id in nodes; n += 1) id = `${START_NODE_ID}_${n}`;
  return id;
}

/**
 * Garantiza que el flujo arranca en un bloque `start`. Devuelve el MISMO
 * objeto si ya es así, para que el llamador sepa que no hubo cambios.
 *
 * - Inicio sembrado antiguo (`message` «Inicio del flujo») → se convierte en
 *   `start` en su sitio: mismo id, misma posición, mismas conexiones.
 * - Entrada que es un bloque real (un Mensaje con contenido propio…) → se
 *   inserta un `start` delante y se conecta a él: el flujo se comporta igual.
 * - Entrada inexistente (flujo vacío o roto) → se crea un `start` suelto.
 */
export function ensureStartEntry(snapshot: BuilderFlowSnapshot): BuilderFlowSnapshot {
  const entryId = snapshot.version.entryNodeId;
  const entry = entryId ? snapshot.nodes[entryId] : undefined;

  if (entry?.type === START_NODE_TYPE) return snapshot;

  if (entry && isLegacySeed(entry)) {
    return {
      ...snapshot,
      nodes: { ...snapshot.nodes, [entry.id]: createStartNode(entry.id, readPosition(entry)) }
    };
  }

  const startId = freeId(snapshot.nodes);

  if (entry) {
    const position = readPosition(entry);
    const edge: BuilderFlowEdge = {
      id: `${startId}->${entry.id}`,
      fromNodeId: startId,
      toNodeId: entry.id,
      priority: 10,
      isFallback: false,
      condition: { operator: "always" }
    };

    return {
      ...snapshot,
      version: { ...snapshot.version, entryNodeId: startId },
      nodes: { ...snapshot.nodes, [startId]: createStartNode(startId, { x: position.x - INSERT_OFFSET_X, y: position.y }) },
      edgesBySource: { ...snapshot.edgesBySource, [startId]: [edge] }
    };
  }

  return {
    ...snapshot,
    version: { ...snapshot.version, entryNodeId: startId },
    nodes: { ...snapshot.nodes, [startId]: createStartNode(startId) }
  };
}
