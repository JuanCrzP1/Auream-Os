import type { ToolDefinition } from "../ToolDefinition";

/**
 * Pixel — registra un evento de conversión en una plataforma de anuncios.
 *
 * `executable: false`. Emitir el evento exige el dominio `integrations` y
 * credenciales por tenant; no existe ninguno de los dos.
 *
 * `defaultConfig` vacío: el nombre del evento y su mapeo de valores dependen de
 * la plataforma destino, que todavía no se ha elegido.
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
  defaultConfig: {},
  colors: {
    header: "#db2777",
    body: "#be185d",
    gradient: "linear-gradient(135deg,#f472b6,#be185d)"
  },
  glyph: "🎯"
};
