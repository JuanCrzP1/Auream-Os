import type { ToolDefinition } from "../ToolDefinition";
import { NOTIFICATION_DEFAULT_CONFIG } from "./notificationConfig";
import { summarizeNotification } from "./summarizeNotification";
import { validateNotification } from "./validateNotification";

/**
 * Notificación — aviso por WhatsApp a un número del equipo, no al cliente.
 *
 * `executable: false`: el editor está completo; falta el adaptador de canal.
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
  defaultContent: {},
  defaultConfig: { ...NOTIFICATION_DEFAULT_CONFIG },
  summarize: summarizeNotification,
  validate: validateNotification,
  colors: {
    header: "#e11d48",
    body: "#be123c",
    gradient: "linear-gradient(135deg,#fb7185,#be123c)"
  },
  glyph: "🔔"
};
