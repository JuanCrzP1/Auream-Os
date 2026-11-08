import "./distributor-editor.css";
import type { ToolCompactProps } from "../ToolUi";
import { OutputHandle } from "../_kit/OutputHandle";
import { describeOutputCount } from "./summarizeDistributor";

/**
 * Nodo «Distribuidor» cerrado: una fila y un punto de conexión por salida.
 * Las salidas las calcula el núcleo con `outputs()`; aquí solo se pintan.
 */
export function DistributorCompactBody({ outputs = [] }: ToolCompactProps) {
  if (outputs.length === 0) {
    return (
      <div className="ds-node">
        <p className="ds-node__empty">Sin salidas configuradas</p>
      </div>
    );
  }

  return (
    <div className="ds-node">
      <span className="ds-node__count">{describeOutputCount(outputs.length)}</span>
      <ul className="ds-node__list">
        {outputs.map((output) => (
          // La fila es el ancla de posición (`position: relative`) del punto.
          <li key={output.id} className="ds-out">
            <span className="ds-out__label">{output.label}</span>
            <OutputHandle id={output.id} className="ds-out__handle" />
          </li>
        ))}
      </ul>
    </div>
  );
}
