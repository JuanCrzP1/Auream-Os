import { NOTIFICATION_BLOCK } from "@contracts/blocks/blockCatalog";
import type { ToolDefinition } from "../ToolDefinition";
import { summarizeNotification } from "./summarizeNotification";

/**
 * Notificación — aviso por WhatsApp a un número del equipo, no al cliente,
 * enviado por el mismo número conectado que atiende el chat (como en Leona).
 */
export const notificationTool: ToolDefinition = {
  ...NOTIFICATION_BLOCK,
  description: "Envía una notificación",
  defaultContentText: "Aviso al equipo",
  editorTitle: "Editar notificación",
  executable: true,
  summarize: summarizeNotification,
  colors: {
    header: "#e11d48",
    body: "#be123c",
    gradient: "linear-gradient(135deg,#fb7185,#be123c)"
  },
  glyph: "🔔"
};
