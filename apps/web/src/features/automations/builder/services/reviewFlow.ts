import { reviewFlow as reviewGraph, type FlowIssue, type FlowIssueCode, type FlowIssueSeverity, type FlowReview } from "@contracts/blocks/reviewFlow";
import type { CanvasEdge, CanvasNode } from "../types/canvas";
import { toGraphEdge, toGraphNode } from "./canvasGraph";

// Revisión del flujo del lienzo. Las reglas son las compartidas
// (`contracts/blocks/reviewFlow.ts`): el agente que edita por MCP recibe los
// mismos avisos. Aquí solo se traduce el lienzo al grafo.

export type { FlowIssue, FlowIssueCode, FlowIssueSeverity, FlowReview };

export function reviewFlow(nodes: ReadonlyArray<CanvasNode>, edges: ReadonlyArray<CanvasEdge>): FlowReview {
  return reviewGraph(nodes.map(toGraphNode), edges.map(toGraphEdge));
}

/** Un problema que haría fallar el flujo, una sola vez aunque esté en varios bloques. */
export interface FlowProblem {
  readonly key: string;
  readonly message: string;
  /** Cuántas veces aparece (bloques o conexiones). */
  readonly count: number;
  /** Bloques a los que llevar, en orden; vacío si el problema no tiene bloque. */
  readonly nodeIds: ReadonlyArray<string>;
}

/**
 * Lo que «Revisar flujo» le muestra a la persona: solo lo que haría fallar el
 * flujo al correr (errores y ciclos sin fin). Un flujo a medias no es un flujo
 * malo: las salidas sin conectar terminan ahí (como en Leona) y los bloques
 * sueltos no corren, así que no se avisan. Lo repetido se agrupa por su texto:
 * dos «IA» sin conexión salen una vez, «· 2 bloques».
 */
export function flowProblems(review: FlowReview): FlowProblem[] {
  const groups = new Map<string, { message: string; count: number; nodeIds: string[] }>();
  for (const issue of review.issues) {
    if (issue.severity !== "error" && issue.code !== "endless-cycle") continue;
    const group = groups.get(issue.message) ?? { message: issue.message, count: 0, nodeIds: [] };
    group.count += 1;
    if (issue.nodeId && !group.nodeIds.includes(issue.nodeId)) group.nodeIds.push(issue.nodeId);
    groups.set(issue.message, group);
  }
  return [...groups.values()].map((group) => ({ key: group.message, ...group }));
}
