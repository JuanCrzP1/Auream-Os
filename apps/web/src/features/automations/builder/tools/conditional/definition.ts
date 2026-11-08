import type { ToolDefinition } from "../ToolDefinition";
import { CONDITION_DEFAULT_CONFIG, conditionOutputs } from "./conditionConfig";
import { summarizeCondition } from "./summarizeCondition";
import { validateCondition } from "./validateCondition";

/**
 * Condicional — evalúa reglas (etiquetas, día, hora, fecha, ventana de 24 h,
 * atención, asesor, campos y variables) y sigue por «Se cumple» o «No se cumple».
 *
 * `executable: true` heredado: el handler existe pero aún no evalúa estas reglas.
 */
export const conditionalTool: ToolDefinition = {
  type: "condition",
  label: "Condicional",
  description: "Bifurca según condición",
  defaultContentText: "Preprocesamiento y flags",
  editorTitle: "Editar condición",
  availableInPalette: true,
  terminal: false,
  executable: true,
  defaultContent: {},
  defaultConfig: { ...CONDITION_DEFAULT_CONFIG },
  outputs: conditionOutputs,
  summarize: summarizeCondition,
  validate: validateCondition,
  colors: {
    header: "#a21caf",
    body: "#86198f",
    gradient: "linear-gradient(135deg,#e879f9,#86198f)"
  },
  glyph: "⬡"
};
