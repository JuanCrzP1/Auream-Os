import { MarkerType } from "@xyflow/react";
import type { FlowEdgeData } from "../types/canvas";

/**
 * Identidad del degradado de las conexiones normales.
 *
 * Se declara aquí —junto al resto de la presentación del edge— y el lienzo lo
 * materializa en un `<defs>` con este mismo id. Así el color vive en un único
 * sitio y no repartido entre componente y hoja de estilos.
 */
export const EDGE_GRADIENT_ID = "auream-edge-flow";

/** Azul eléctrico de salida. Misma familia que el resplandor ambiental. */
export const EDGE_GRADIENT_START = "#38bdf8";

/** Violeta de llegada. Es el primario de Auream OS. */
export const EDGE_GRADIENT_END = "#8b5cf6";

/**
 * Traduce los datos de un edge a las props visuales que consume React Flow.
 *
 * Es la ÚNICA frontera que decide qué se pinta de una conexión. El modelo
 * —`priority`, `condition`, `isFallback`— se conserva intacto en `data`; aquí
 * sólo se elige su representación.
 *
 * La prioridad NO se rotula en el lienzo: es un detalle de ejecución que el
 * `EdgeEvaluator` usa para ordenar las salidas, no información que quien
 * construye el flujo necesite leer sobre cada línea. Sigue siendo editable
 * desde el inspector de edge y sigue viajando al snapshot.
 *
 * El fallback sí se rotula: marca la ruta de rescate, y es la única etiqueta
 * que aporta significado al leer el grafo.
 */
export function buildEdgePresentation(edge: FlowEdgeData) {
  return {
    animated: edge.isFallback,
    label: edge.isFallback ? edge.label : undefined,
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: 18,
      height: 18,
      // La punta toma el color final del degradado: un marcador SVG no puede
      // pintarse con el gradiente del trazo.
      color: edge.isFallback ? "#f59e0b" : EDGE_GRADIENT_END
    },
    style: {
      // Conexión normal: degradado azul eléctrico → violeta, definido una sola
      // vez en el lienzo (`EDGE_GRADIENT_ID`). El fallback conserva su ámbar
      // sólido: es semántica, no decoración.
      stroke: edge.isFallback ? "#f59e0b" : `url(#${EDGE_GRADIENT_ID})`,
      strokeWidth: edge.isFallback ? 2.8 : 2.3
    },
    labelStyle: {
      fill: edge.isFallback ? "#fcd34d" : "#cbd5e1",
      fontSize: 12,
      fontWeight: 700
    }
  };
}