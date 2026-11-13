import type { BuilderFlowSnapshot } from "../../../../contracts/FlowSnapshot";
import { isStructurallyConnected } from "../../validation/application/isStructurallyConnected";
import { reviewDraft } from "../../editing/domain/draftGraph";
import { convertBuilderSnapshotToRuntime } from "./convertBuilderSnapshotToRuntime";

export interface BuilderGraphSummary {
  readonly nodeCount: number;
  readonly connectionStatus: "connected" | "disconnected";
  /** Lo mismo que cuenta «Revisión del flujo» en el editor: errores (no funcionará así) y avisos. */
  readonly reviewErrors: number;
  readonly reviewWarnings: number;
}

/** El resumen de un flujo sin borrador todavía. */
export const EMPTY_GRAPH_SUMMARY: BuilderGraphSummary = { nodeCount: 0, connectionStatus: "disconnected", reviewErrors: 0, reviewWarnings: 0 };

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
 * Aparte van los errores y avisos de la revisión del editor (un Píxel sin
 * píxel elegido, una Notificación sin número…): así la lista nunca muestra en
 * verde un flujo que el editor marca con problemas.
 */
export function deriveBuilderGraphSummary(
  draft: BuilderFlowSnapshot,
  tenantId: string
): BuilderGraphSummary {
  const review = reviewDraft(draft);
  return {
    nodeCount: Object.keys(draft.nodes).length,
    reviewErrors: review.errorCount,
    reviewWarnings: review.warningCount,
    connectionStatus: isStructurallyConnected(convertBuilderSnapshotToRuntime(draft, tenantId))
      ? "connected"
      : "disconnected"
  };
}
