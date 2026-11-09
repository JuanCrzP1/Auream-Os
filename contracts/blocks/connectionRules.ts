import { canConnectToItself } from "../FlowConnectionRules";
import type { NodeType } from "../FlowSnapshot";
import { blockOutputs } from "./blockCatalog";
import type { BlockData } from "./BlockRules";
import type { GraphEdge, GraphNode } from "./FlowGraph";

// ---------------------------------------------------------------------------
// ¿Se puede trazar esta conexión? La misma respuesta en el lienzo (al soltar
// el cable) y en el servidor MCP (cuando un agente conecta dos bloques).
// Modelo: de cada salida sale como mucho UNA conexión; al inicio no llega
// ninguna. Ver docs/architecture/flow-connections.md.
// ---------------------------------------------------------------------------

export type ConnectionRejection = "unknown-node" | "self" | "into-entry" | "invalid-output" | "output-taken";

export type ConnectionCheck =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: ConnectionRejection; readonly message: string };

export interface ProposedConnection {
  readonly source: string | null;
  readonly target: string | null;
  readonly output?: string | null;
}

export const CONNECTION_MESSAGES: Readonly<Record<ConnectionRejection, string>> = {
  "unknown-node": "No se puede conectar con un bloque que ya no existe.",
  self: "Un bloque no puede conectarse consigo mismo. Solo «Otra respuesta» del Menú puede volver al mismo Menú.",
  "into-entry": "El bloque de inicio no recibe conexiones: es donde empieza el flujo.",
  "invalid-output": "Esa salida ya no existe en la configuración del bloque.",
  "output-taken": "Esa salida ya está conectada. Elimina la conexión actual para cambiar su destino."
};

const reject = (reason: ConnectionRejection): ConnectionCheck => ({ ok: false, reason, message: CONNECTION_MESSAGES[reason] });
const outputKey = (output: string | null | undefined): string => output ?? "";

/** ¿Existe esa salida en el bloque? Uno de salida única solo admite «sin salida»; uno con salidas, una de ellas (o ninguna = la primera). */
export function isValidOutput(type: string, config: BlockData, output: string | null | undefined): boolean {
  const outputs = blockOutputs(type, config);
  if (outputs === null) return !output;
  if (!output) return outputs.length > 0;
  return outputs.some((item) => item.id === output);
}

export function checkConnection(nodes: ReadonlyArray<GraphNode>, edges: ReadonlyArray<GraphEdge>, connection: ProposedConnection): ConnectionCheck {
  const source = nodes.find((node) => node.id === connection.source);
  const target = nodes.find((node) => node.id === connection.target);
  if (!source || !target) return reject("unknown-node");
  if (source.id === target.id && !canConnectToItself(source.type as NodeType, connection.output)) return reject("self");
  if (target.isEntry) return reject("into-entry");
  if (!source.isEntry && !isValidOutput(source.type, source.config, connection.output)) return reject("invalid-output");
  const taken = edges.some((edge) => edge.source === source.id && outputKey(edge.output) === outputKey(connection.output));
  if (taken) return reject("output-taken");
  return { ok: true };
}

/** Bloques con dos o más conexiones saliendo de la MISMA salida (un error: el motor solo sigue una). */
export function findOvercrowdedOutputs(edges: ReadonlyArray<Pick<GraphEdge, "source" | "output">>): ReadonlyArray<string> {
  const counts = new Map<string, number>();
  for (const edge of edges) {
    const key = `${edge.source}\u0000${outputKey(edge.output)}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const sources = new Set<string>();
  for (const [key, count] of counts) if (count > 1) sources.add(key.split("\u0000")[0]!);
  return [...sources];
}
