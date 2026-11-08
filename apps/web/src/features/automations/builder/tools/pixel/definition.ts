import type { ToolDefinition } from "../ToolDefinition";
import { PIXEL_DEFAULT_CONFIG } from "./pixelConfig";
import { summarizePixel } from "./summarizePixel";
import { validatePixel } from "./validatePixel";

/**
 * Pixel — envía un evento (Lead o Compra) a la API de Conversiones de Meta.
 *
 * `executable: false`: el editor está completo; faltan el dominio
 * `integrations` y las credenciales por tenant.
 */
export const pixelTool: ToolDefinition = {
  type: "pixel",
  label: "Pixel",
  description: "Registra eventos de conversión",
  defaultContentText: "Evento de conversión",
  editorTitle: "Editar pixel",
  availableInPalette: true,
  terminal: false,
  executable: false,
  defaultContent: {},
  defaultConfig: { ...PIXEL_DEFAULT_CONFIG },
  summarize: summarizePixel,
  validate: validatePixel,
  colors: {
    header: "#9d174d",
    body: "#831843",
    gradient: "linear-gradient(135deg,#ec4899,#831843)"
  },
  glyph: "🎯"
};
