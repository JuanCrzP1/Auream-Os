import "../_kit/kit.css";
import type { ToolCompactProps } from "../ToolUi";
import { readGoToFlowConfig } from "./goToFlowConfig";

/** Nodo cerrado: el flujo de destino como insignia. Sin puntos de salida: la conversación sigue allá. */
export function GoToFlowCompactBody({ draft }: ToolCompactProps) {
  const read = readGoToFlowConfig(draft.config);

  return (
    <div className="kit-node">
      <span className="kit-node__eyebrow">Ir a otro flujo</span>
      {read.flowId ? (
        <div className="kit-node__row">
          <span className="kit-node__badge">{read.flowName || "Flujo elegido"}</span>
          <span className="kit-node__meta">Este termina aquí</span>
        </div>
      ) : (
        <span className="kit-node__meta">Sin flujo elegido</span>
      )}
    </div>
  );
}
