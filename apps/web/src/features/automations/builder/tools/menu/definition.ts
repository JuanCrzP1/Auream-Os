import type { ToolDefinition } from "../ToolDefinition";
import { MENU_DEFAULT_CONFIG, menuOutputs } from "./menuConfig";
import { summarizeMenu } from "./summarizeMenu";
import { validateMenu } from "./validateMenu";

/**
 * Menú — lista o botones interactivos de WhatsApp. Una salida por opción, más
 * «Otra respuesta» y, con límite, «Tiempo agotado».
 *
 * Se ejecuta (`MenuNodeHandler`): envía el menú, reconoce la opción por botón,
 * número o texto y sale por ella. «Tiempo agotado» llega con la cola (C6).
 */
export const menuTool: ToolDefinition = {
  type: "menu",
  label: "Menú",
  description: "Ofrece opciones al usuario",
  defaultContentText: "Opciones para el usuario",
  editorTitle: "Editar menú",
  availableInPalette: true,
  terminal: false,
  executable: true,
  defaultContent: {},
  defaultConfig: { ...MENU_DEFAULT_CONFIG },
  outputs: menuOutputs,
  summarize: summarizeMenu,
  validate: validateMenu,
  colors: {
    header: "#854d0e",
    body: "#713f12",
    gradient: "linear-gradient(135deg,#ca8a04,#713f12)"
  },
  glyph: "☰"
};
