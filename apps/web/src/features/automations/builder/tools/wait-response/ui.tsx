import type { ToolUi } from "../ToolUi";
import { WaitResponseIcon } from "./WaitResponseIcon";
import { WaitResponseEditor } from "./WaitResponseEditor";
import { WaitResponseCompactBody } from "./WaitResponseCompactBody";

/**
 * Mitad React de la herramienta. Único punto donde declara cómo se ve.
 *
 * Al declarar `Editor`, el sistema común la abre DENTRO del lienzo con el mismo
 * marco, el mismo tamaño y la misma barra de Guardar/Cancelar que cualquier otra
 * herramienta que lo declare. Esa decisión no está escrita en ningún sitio como
 * «si es Esperar respuesta»: `BuilderPage` pregunta si hay editor y
 * `ExpandedNodeOverlay` lo monta. No hubo que tocar ninguno de los dos.
 */
export const waitResponseUi: ToolUi = {
  type: "question",
  Icon: WaitResponseIcon,
  frame: "card",
  CompactBody: WaitResponseCompactBody,
  Editor: WaitResponseEditor,
  // DOS RESULTADOS, no uno: el cliente responde, o se agota el tiempo. Cada uno
  // necesita su handle y su rótulo dentro de la composición del nodo, y cuántos
  // hay depende de la configuración —con «sin límite» no hay vencimiento—, así
  // que el cascarón no puede colocarlos. Los monta `WaitResponseCompactBody`.
  ownsOutputs: true
};
