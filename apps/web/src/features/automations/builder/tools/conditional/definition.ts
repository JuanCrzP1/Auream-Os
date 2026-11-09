import { CONDITION_BLOCK } from "@contracts/blocks/blockCatalog";
import type { ToolDefinition } from "../ToolDefinition";
import { summarizeCondition } from "./summarizeCondition";

/**
 * Condicional — evalúa reglas (etiquetas, día, hora, fecha, ventana de 24 h,
 * atención, asesor, campos y variables) y sigue por «Se cumple» o «No se cumple».
 *
 * Se ejecuta (`ConditionNodeHandler`): día, hora y fecha en la zona del
 * negocio, ventana de 24 h, datos y campos del contacto. Etiquetas, atención,
 * asesor y variables globales cuentan como «no disponible» (regla no cumplida)
 * hasta que existan Contactos y Conversaciones.
 */
export const conditionalTool: ToolDefinition = {
  ...CONDITION_BLOCK,
  description: "Bifurca según condición",
  defaultContentText: "Preprocesamiento y flags",
  editorTitle: "Editar condición",
  executable: true,
  summarize: summarizeCondition,
  colors: {
    header: "#a21caf",
    body: "#86198f",
    gradient: "linear-gradient(135deg,#e879f9,#86198f)"
  },
  glyph: "⬡"
};
