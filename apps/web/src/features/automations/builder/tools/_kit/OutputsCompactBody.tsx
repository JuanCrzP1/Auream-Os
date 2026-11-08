import "./kit.css";
import type { ComponentType } from "react";
import type { ToolCompactProps } from "../ToolUi";
import type { ToolData } from "../ToolDefinition";
import { OutputHandle } from "./OutputHandle";
import { outputTone } from "./layout";

/**
 * Cuerpo de nodo cerrado para herramientas con salidas con nombre: una línea
 * de resumen y una fila con punto de conexión por salida.
 */
export function createOutputsCompactBody(
  summarize: (content: ToolData, config: ToolData) => string
): ComponentType<ToolCompactProps> {
  return function OutputsCompactBody({ draft, outputs = [] }: ToolCompactProps) {
    return (
      <div className="kit-node">
        <p className="kit-node__summary">{summarize(draft.content, draft.config)}</p>
        {outputs.length === 0 ? (
          <p className="kit-node__empty">Sin salidas configuradas</p>
        ) : (
          <ul className="kit-node__outputs">
            {outputs.map((output) => (
              <li key={output.id} className={`kit-out kit-out--${outputTone(output.id)}`}>
                <span className="kit-out__dot" aria-hidden="true" />
                <span className="kit-out__label">{output.label}</span>
                <OutputHandle id={output.id} className="kit-out__handle" />
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  };
}
