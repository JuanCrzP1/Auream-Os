import type { ToolDefinition } from "../ToolDefinition";
import { PIXEL_DEFAULT_CONFIG } from "./pixelConfig";
import { summarizePixel } from "./summarizePixel";
import { validatePixel } from "./validatePixel";

/**
 * Pixel — registra una conversión (Lead o Compra) en la API de Conversiones
 * de Meta con un píxel de la cuenta (token cifrado, nunca en el flujo). Si el
 * contacto llegó por un anuncio de clic a WhatsApp, se atribuye a ese anuncio.
 * Lo ejecuta `PixelNodeHandler`; si Meta falla, el flujo sigue.
 */
export const pixelTool: ToolDefinition = {
  type: "pixel",
  label: "Pixel",
  description: "Registra eventos de conversión",
  defaultContentText: "Evento de conversión",
  editorTitle: "Editar pixel",
  availableInPalette: true,
  terminal: false,
  executable: true,
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
