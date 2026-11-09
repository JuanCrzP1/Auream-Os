import {
  checkConnection as checkGraphConnection,
  findOvercrowdedOutputs as findGraphOvercrowdedOutputs,
  type ConnectionCheck,
  type ConnectionRejection
} from "@contracts/blocks/connectionRules";
import type { CanvasEdge, CanvasNode } from "../types/canvas";
import { toGraphEdge, toGraphNode } from "./canvasGraph";

// ---------------------------------------------------------------------------
// Reglas al CONECTAR dos bloques en el lienzo. Son las compartidas
// (`contracts/blocks/connectionRules.ts`, las mismas que aplica el servidor MCP
// cuando un agente conecta bloques); aquí solo se traducen desde el lienzo.
//
//   · De cada salida sale como mucho UNA conexión (también la del bloque de
//     entrada, que tiene una sola).
//   · Un bloque no se conecta consigo mismo, salvo «Otra respuesta» del Menú
//     (vuelve a mostrar el menú, como en Leona).
//   · Al bloque de entrada no llega ninguna conexión.
//   · La salida debe existir en la configuración actual del bloque.
// ---------------------------------------------------------------------------

export type { ConnectionCheck, ConnectionRejection };

export interface ProposedConnection {
  readonly source: string | null;
  readonly target: string | null;
  readonly sourceHandle?: string | null;
}

export function checkConnection(nodes: ReadonlyArray<CanvasNode>, edges: ReadonlyArray<CanvasEdge>, connection: ProposedConnection): ConnectionCheck {
  return checkGraphConnection(nodes.map(toGraphNode), edges.map(toGraphEdge), {
    source: connection.source,
    target: connection.target,
    output: connection.sourceHandle ?? null
  });
}

/** Bloques con dos o más conexiones saliendo de la MISMA salida. */
export function findOvercrowdedOutputs(edges: ReadonlyArray<CanvasEdge>): ReadonlyArray<string> {
  return findGraphOvercrowdedOutputs(edges.map(toGraphEdge));
}
