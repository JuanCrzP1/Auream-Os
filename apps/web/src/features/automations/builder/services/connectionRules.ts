import { isValidSourceHandle } from "./nodeOutputs";
import type { CanvasEdge, CanvasNode } from "../types/canvas";

// ---------------------------------------------------------------------------
// Reglas al CONECTAR dos bloques en el lienzo. Puras: reciben el grafo y la
// conexión propuesta y dicen si se permite y por qué no.
//
//   · De cada salida sale como mucho UNA conexión (también la del bloque de
//     entrada, que tiene una sola).
//   · Un bloque no se conecta consigo mismo.
//   · Al bloque de entrada no llega ninguna conexión.
//   · La salida debe existir en la configuración actual del bloque.
//
// Mismo modelo que valida el backend: docs/architecture/flow-connections.md.
// ---------------------------------------------------------------------------

export type ConnectionRejection = "unknown-node" | "self" | "into-entry" | "invalid-output" | "output-taken";

export type ConnectionCheck =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: ConnectionRejection; readonly message: string };

export interface ProposedConnection {
  readonly source: string | null;
  readonly target: string | null;
  readonly sourceHandle?: string | null;
}

const MESSAGES: Readonly<Record<ConnectionRejection, string>> = {
  "unknown-node": "No se puede conectar con un bloque que ya no existe.",
  self: "Un bloque no puede conectarse consigo mismo.",
  "into-entry": "El bloque de inicio no recibe conexiones: es donde empieza el flujo.",
  "invalid-output": "Esa salida ya no existe en la configuración del bloque.",
  "output-taken": "Esa salida ya está conectada. Elimina la conexión actual para cambiar su destino."
};

const reject = (reason: ConnectionRejection): ConnectionCheck => ({ ok: false, reason, message: MESSAGES[reason] });

/** Salida normalizada: `null`/`undefined`/«» son la salida única implícita. */
const handleKey = (handle: string | null | undefined): string => handle ?? "";

export function checkConnection(
  nodes: ReadonlyArray<CanvasNode>,
  edges: ReadonlyArray<CanvasEdge>,
  connection: ProposedConnection
): ConnectionCheck {
  const source = nodes.find((node) => node.id === connection.source);
  const target = nodes.find((node) => node.id === connection.target);

  if (!source || !target) return reject("unknown-node");
  if (source.id === target.id) return reject("self");
  if (target.data.isEntry) return reject("into-entry");

  if (!source.data.isEntry && !isValidSourceHandle(source.data.nodeType, source.data.config, connection.sourceHandle)) {
    return reject("invalid-output");
  }

  const taken = edges.some(
    (edge) => edge.source === source.id && handleKey(edge.sourceHandle) === handleKey(connection.sourceHandle)
  );
  if (taken) return reject("output-taken");

  return { ok: true };
}

/**
 * Salidas con más de una conexión en un grafo ya construido (p. ej. un flujo
 * guardado antes de estas reglas). Devuelve el id de cada bloque afectado.
 */
export function findOvercrowdedOutputs(edges: ReadonlyArray<CanvasEdge>): ReadonlyArray<string> {
  const counts = new Map<string, number>();
  for (const edge of edges) {
    const key = `${edge.source}\u0000${handleKey(edge.sourceHandle)}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const sources = new Set<string>();
  for (const [key, count] of counts) {
    if (count > 1) sources.add(key.split("\u0000")[0]);
  }
  return [...sources];
}
