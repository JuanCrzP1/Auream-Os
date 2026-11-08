import "./interval-editor.css";
import { readIntervalConfig } from "@contracts/IntervalConfig";
import type { ToolCompactProps } from "../ToolUi";
import { describeMoment } from "./summarizeInterval";
import { TRIGGER_ICON } from "./intervalModeIcons";

const TRIGGER_LABEL = {
  interval: "Intervalo",
  date: "Fecha"
} as const;

/**
 * Nodo «Programador» cerrado. La línea temporal del margen (punto, trazo y
 * codo) la dibuja la hoja con pseudo-elementos; aquí solo va lo que se lee:
 * la clase de espera, el valor y hacia dónde sigue.
 */
export function IntervalCompactBody({ draft }: ToolCompactProps) {
  const config = readIntervalConfig(draft.config);
  const Icon = TRIGGER_ICON[config.trigger];

  return (
    <div className="iv-node">
      <span className="iv-node__mode">
        {TRIGGER_LABEL[config.trigger]}
        {config.scheduleEnabled ? " · en horario" : null}
      </span>

      <p className="iv-node__detail">
        <span className="iv-node__glyph" aria-hidden="true">
          <Icon />
        </span>
        {describeMoment(config)}
      </p>

      <span className="iv-node__next">continúa el flujo</span>
    </div>
  );
}
