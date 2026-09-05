import type { ToolUi } from "../ToolUi";
import { MessageIcon } from "./MessageIcon";
import { MessageEditor } from "./MessageEditor";
import { MessageCompactBody } from "./MessageCompactBody";

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
  // Primera herramienta con cuerpo compacto propio. El hueco existía en el
  // contrato desde el principio; hasta ahora todas se conformaban con el
  // resumen de una línea del cascarón. Mensaje no: su contenido ES una
  // secuencia, y una secuencia se reconoce viendo sus piezas en orden.
  CompactBody: MessageCompactBody,
  Editor: MessageEditor
};
