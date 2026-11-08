import "../_kit/kit.css";
import type { ToolCompactProps } from "../ToolUi";
import { PIXEL_EVENT_LABELS, readPixelConfig } from "./pixelConfig";

/** Nodo cerrado: evento como insignia, valor si es compra y el pixel abreviado. */
export function PixelCompactBody({ draft }: ToolCompactProps) {
  const read = readPixelConfig(draft.config);

  return (
    <div className="kit-node">
      <span className="kit-node__eyebrow">Meta · Conversiones</span>
      <div className="kit-node__row">
        <span className="kit-node__badge">{PIXEL_EVENT_LABELS[read.event]}</span>
        {read.event === "purchase" && read.value.trim() ? (
          <span className="kit-node__meta">
            {read.value.trim()} {read.currency}
          </span>
        ) : null}
      </div>
      <span className="kit-node__meta">
        {read.pixelId ? `Pixel ···${read.pixelId.slice(-6)}` : "Sin ID de pixel"}
      </span>
    </div>
  );
}
