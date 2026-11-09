import { PIXEL_BLOCK } from "@contracts/blocks/blockCatalog";
import type { ToolDefinition } from "../ToolDefinition";
import { summarizePixel } from "./summarizePixel";

/**
 * Pixel — registra una conversión (Lead o Compra) en la API de Conversiones
 * de Meta con un píxel de la cuenta (token cifrado, nunca en el flujo). Si el
 * contacto llegó por un anuncio de clic a WhatsApp, se atribuye a ese anuncio.
 * Lo ejecuta `PixelNodeHandler`; si Meta falla, el flujo sigue.
 */
export const pixelTool: ToolDefinition = {
  ...PIXEL_BLOCK,
  description: "Registra eventos de conversión",
  defaultContentText: "Evento de conversión",
  editorTitle: "Editar pixel",
  executable: true,
  summarize: summarizePixel,
  colors: {
    header: "#9d174d",
    body: "#831843",
    gradient: "linear-gradient(135deg,#ec4899,#831843)"
  },
  glyph: "🎯"
};
