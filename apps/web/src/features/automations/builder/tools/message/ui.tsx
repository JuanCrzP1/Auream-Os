import type { ToolUi } from "../ToolUi";
import { MessageIcon } from "./MessageIcon";
import { MessageEditor } from "./MessageEditor";

/**
 * Mitad React de la herramienta. Único punto donde declara cómo se ve.
 *
 * Es la primera que declara `Editor`, y con eso el sistema común la abre DENTRO
 * del lienzo en lugar de en el modal heredado. Esa decisión no está escrita en
 * ningún sitio como «si es Mensaje»: se toma preguntando si hay editor.
 */
export const messageUi: ToolUi = {
  type: "message",
  Icon: MessageIcon,
  frame: "card",
  Editor: MessageEditor
};
