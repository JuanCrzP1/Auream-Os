import type { ToolUi } from "../ToolUi";
import { IntervalIcon } from "./IntervalIcon";
import { IntervalEditor } from "./IntervalEditor";
import { IntervalCompactBody } from "./IntervalCompactBody";

/**
 * Mitad React de la herramienta. Único punto donde declara cómo se ve.
 *
 * Al declarar `Editor`, el sistema común la abre DENTRO del lienzo con el mismo
 * marco, el mismo tamaño y la misma barra de Guardar/Cancelar que cualquier
 * otra herramienta que lo declare. Esa decisión no está escrita en ningún sitio
 * como «si es Intervalo»: `BuilderPage` pregunta si hay editor y
 * `ExpandedNodeOverlay` lo monta. No hubo que tocar ninguno de los dos.
 *
 * NO DECLARA `ownsOutputs`: un Intervalo tiene un solo camino de salida —la
 * conversación continúa, y solo cambia cuándo—, así que el handle único del
 * cascarón es exactamente lo que necesita. Esa bandera es para herramientas con
 * varios resultados posibles.
 */
export const intervalUi: ToolUi = {
  type: "delay",
  Icon: IntervalIcon,
  frame: "circle",
  CompactBody: IntervalCompactBody,
  Editor: IntervalEditor
};
