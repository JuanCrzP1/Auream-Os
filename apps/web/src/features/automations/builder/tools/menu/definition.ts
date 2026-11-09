import { MENU_BLOCK } from "@contracts/blocks/blockCatalog";
import type { ToolDefinition } from "../ToolDefinition";
import { summarizeMenu } from "./summarizeMenu";

/**
 * Menú — lista o botones interactivos de WhatsApp. Una salida por opción, más
 * «Otra respuesta» y, con límite, «Tiempo agotado».
 *
 * Se ejecuta (`MenuNodeHandler`): envía el menú, reconoce la opción por botón,
 * número o texto y sale por ella. «Tiempo agotado» lo dispara la cola de tareas (C6).
 */
export const menuTool: ToolDefinition = {
  ...MENU_BLOCK,
  description: "Ofrece opciones al usuario",
  defaultContentText: "Opciones para el usuario",
  editorTitle: "Editar menú",
  executable: true,
  summarize: summarizeMenu,
  colors: {
    header: "#854d0e",
    body: "#713f12",
    gradient: "linear-gradient(135deg,#ca8a04,#713f12)"
  },
  glyph: "☰"
};
