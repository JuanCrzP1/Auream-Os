import type { BuilderFlowSnapshot } from "../../../../contracts/FlowSnapshot";
import { isStructurallyConnected } from "../../validation/application/isStructurallyConnected";
import { convertBuilderSnapshotToRuntime } from "./convertBuilderSnapshotToRuntime";

export interface BuilderGraphSummary {
  readonly nodeCount: number;
  readonly connectionStatus: "connected" | "disconnected";
}

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
