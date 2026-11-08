import { INTERVAL_DEFAULT_CONFIG } from "@contracts/IntervalConfig";
import type { ToolDefinition } from "../ToolDefinition";
import { summarizeInterval } from "./summarizeInterval";
import { validateInterval } from "./validateInterval";

/**
 * Programador — decide cuándo continúa la conversación.
 *
 * El tipo sigue siendo `delay` (clave persistida) y la carpeta `interval/`;
 * solo el rótulo visible cambió.
 *
 * `executable: true`: `DelayNodeHandler` aparca la sesión en `delayed`. Falta
 * la cola que la despierte (Fase C) y que el handler lea este contrato con
 * `readIntervalConfig`/`intervalWaitMs` en lugar de `resumeAt`/`delayMs`.
 */
export const intervalTool: ToolDefinition = {
  type: "delay",
  label: "Programador",
  description: "Define cuándo continuar",
  defaultContentText: "Continuar más tarde",
  editorTitle: "Programador",
  availableInPalette: true,
  terminal: false,
  executable: true,
  defaultConfig: { ...INTERVAL_DEFAULT_CONFIG },
  summarize: summarizeInterval,
  validate: validateInterval,
  // Cyan aprobado por producto. El editor lo repite en `--iv-cyan`/`--iv-deep`.
  colors: {
    header: "#0891b2",
    body: "#0e7490",
    gradient: "linear-gradient(135deg,#22d3ee,#0e7490)"
  },
  glyph: "⏱"
};
