import type { ToolUi } from "../ToolUi";
import { DistributorIcon } from "./DistributorIcon";
import { DistributorEditor } from "./DistributorEditor";
import { DistributorCompactBody } from "./DistributorCompactBody";

/**
 * Mitad React de la herramienta. Único punto donde declara cómo se ve.
 *
 * Al declarar `Editor`, el sistema común la abre DENTRO del lienzo con el mismo
 * marco, el mismo tamaño y la misma barra de Guardar/Cancelar que cualquier otra
 * herramienta que lo declare. Esa decisión no está escrita en ningún sitio como
 * «si es Distribuidor»: `BuilderPage` pregunta si hay editor y
 * `ExpandedNodeOverlay` lo monta. No hubo que tocar ninguno de los dos.
 */
export const distributorUi: ToolUi = {
  type: "distributor",
  Icon: DistributorIcon,
  frame: "diamond",
  CompactBody: DistributorCompactBody,
  Editor: DistributorEditor,
  // TANTAS SALIDAS COMO EL USUARIO CONFIGURE, y por eso el cascarón no puede
  // poner ninguna: no sabe cuántas hay —depende de la configuración del nodo— ni
  // junto a qué rótulo va cada una. Los monta `DistributorCompactBody`, que es
  // quien recorre la lista. Con cero salidas no se pinta ningún punto de origen,
  // que es lo correcto: todavía no hay camino al que conectar.
  ownsOutputs: true
};
