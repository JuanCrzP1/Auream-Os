import type { ToolDefinition } from "../ToolDefinition";

/**
 * Comprobante automático — procesa un comprobante de pago recibido.
 *
 * `executable: false`. Requiere almacenamiento de media y un extractor de
 * datos del comprobante; no existe ninguno de los dos.
 *
 * `defaultConfig` queda vacío a propósito: los campos que necesita —qué se
 * extrae, contra qué se valida, qué se considera válido— son especificación de
 * negocio todavía no acordada, y no se inventan aquí.
 */
export const paymentProofTool: ToolDefinition = {
  type: "payment-proof",
  label: "Comprobante automático",
  description: "Procesa comprobantes automáticamente",
  defaultContentText: "Validación de comprobante",
  editorTitle: "Editar comprobante automático",
  availableInPalette: true,
  terminal: false,
  executable: false,
  defaultConfig: {},
  colors: {
    header: "#0d9488",
    body: "#0f766e",
    gradient: "linear-gradient(135deg,#2dd4bf,#0f766e)"
  },
  glyph: "🧾"
};
