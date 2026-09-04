import type { ToolUi } from "../ToolUi";
import { EndIcon } from "./EndIcon";

/**
 * Mitad React de la herramienta. Único punto donde declara cómo se ve.
 *
 * `pill` porque es un nodo de SISTEMA, la misma clase que Inicio: los dos
 * cierran el grafo por un extremo y ninguno se ofrece en la paleta. Que
 * compartan silueta es la información, no una coincidencia.
 *
 * `pill` queda así estrenado por `end`. Inicio lo adoptará cuando deje de ser
 * un nodo `message` disfrazado y tenga tipo propio.
 *
 * Esta asignación no venía en el reparto aprobado: se decide aquí y se señala
 * para revisión.
 */
export const endUi: ToolUi = {
  type: "end",
  Icon: EndIcon,
  frame: "pill"
};
