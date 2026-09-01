import type { ToolDefinition } from "../ToolDefinition";

/**
 * Notificación — envía un aviso a un destinatario interno.
 *
 * `executable: false`. El canal por el que se avisa —correo, WhatsApp del
 * equipo, aviso en la plataforma— no está decidido, y sin canal no hay nada que
 * ejecutar.
 *
 * No confundir con Mensaje: Mensaje habla con el usuario de la conversación;
 * Notificación avisa a alguien del equipo.
 */
export const notificationTool: ToolDefinition = {
  type: "notification",
  label: "Notificación",
  description: "Envía una notificación",
  defaultContentText: "Aviso al equipo",
  editorTitle: "Editar notificación",
  availableInPalette: true,
  terminal: false,
  executable: false,
  defaultConfig: {},
  colors: {
    header: "#e11d48",
    body: "#be123c",
    gradient: "linear-gradient(135deg,#fb7185,#be123c)"
  },
  glyph: "🔔"
};
