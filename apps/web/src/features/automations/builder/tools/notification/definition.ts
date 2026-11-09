import type { ToolDefinition } from "../ToolDefinition";
import { NOTIFICATION_DEFAULT_CONFIG } from "./notificationConfig";
import { summarizeNotification } from "./summarizeNotification";
import { validateNotification } from "./validateNotification";

/**
 * Notificación — aviso por WhatsApp a un número del equipo, no al cliente,
 * enviado por el mismo número conectado que atiende el chat (como en Leona).
 */
export const notificationTool: ToolDefinition = {
  type: "notification",
  label: "Notificación",
  description: "Envía una notificación",
  defaultContentText: "Aviso al equipo",
  editorTitle: "Editar notificación",
  availableInPalette: true,
  terminal: false,
  executable: true,
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
