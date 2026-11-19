import type { BuilderFlowSnapshot } from "../../../../contracts/FlowSnapshot";
import { isStructurallyConnected } from "../../validation/application/isStructurallyConnected";
import { convertBuilderSnapshotToRuntime } from "./convertBuilderSnapshotToRuntime";

export interface BuilderGraphSummary {
  readonly nodeCount: number;
  readonly connectionStatus: "connected" | "disconnected";
}

/** El resumen de un flujo sin borrador todavía. */
export const EMPTY_GRAPH_SUMMARY: BuilderGraphSummary = { nodeCount: 0, connectionStatus: "disconnected" };

/**
 * Proyección de listado del draft actual.
 *
 * No guarda ningún dato: cuenta los nodos reales y pregunta por la topología a
 * `isStructurallyConnected`, que es la autoridad de «conectado».
 *
 * Antes preguntaba a `GraphValidator`, que es la autoridad de «publicable». Son
 * dos preguntas distintas y mezclarlas pintaba de rojo estructuras sanas: un
 * `Inicio → Etiquetas` unido por una flecha real salía desconectado sólo porque
 * le faltaba un nodo `Finalizar` que la paleta no ofrece. El punto del Hub
 * describe lo que el usuario ve dibujado, no si el flujo está listo para
 * publicarse.
 *
 * La lista no cuenta lo que le falta a cada bloque: un flujo a medias no es un
 * flujo malo (Leona tampoco lo marca). Eso se ve dentro, en «Revisar flujo».
 */
export function deriveBuilderGraphSummary(
  draft: BuilderFlowSnapshot,
  tenantId: string
): BuilderGraphSummary {
  return {
    nodeCount: Object.keys(draft.nodes).length,
    connectionStatus: isStructurallyConnected(convertBuilderSnapshotToRuntime(draft, tenantId))
      ? "connected"
      : "disconnected"
  };
}
