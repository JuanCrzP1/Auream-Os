import {
  BezierEdge,
  EdgeLabelRenderer,
  getBezierPath,
  useReactFlow,
  type EdgeProps
} from "@xyflow/react";
import { TrashIcon } from "@features/automations/shared/TrashIcon";
import type { CanvasEdge } from "@features/automations/builder/types/canvas";

/**
 * La conexión del lienzo, con su única acción contextual: eliminarla.
 *
 * ENVUELVE al edge por defecto en lugar de sustituirlo. `BezierEdge` es
 * exactamente el componente que React Flow monta para `type: "default"`, que es
 * lo que había hasta ahora, así que la curva, el degradado, el grosor, la punta
 * de flecha, la animación del fallback y su etiqueta se siguen pintando con el
 * mismo código de siempre. Aquí no se redibuja nada: solo se añade un botón
 * encima cuando toca. Reimplementar el trazo habría sido la forma segura de
 * que la conexión dejara de verse igual.
 *
 * EL BOTÓN SOLO EXISTE MIENTRAS LA CONEXIÓN ESTÁ SELECCIONADA, y `selected` lo
 * decide React Flow —clic en la arista lo enciende, clic en el lienzo vacío lo
 * apaga— a través del mismo `onEdgesChange` que ya gobierna los edges. No hay
 * un segundo registro de selección para esto.
 *
 * SU SITIO ES EL PUNTO MEDIO REAL DE LA CURVA. `getBezierPath` devuelve, junto
 * al trazado, el centro que React Flow usa para las etiquetas de la propia
 * arista; se le pasan los mismos puntos y posiciones de handle que recibe
 * `BezierEdge`, de modo que el botón sigue a la curva sea horizontal, diagonal
 * o larga, y se mueve con los nodos sin que nadie recalcule nada.
 *
 * `EdgeLabelRenderer` es el portal de React Flow para HTML sobre el lienzo:
 * hereda el pan y el zoom del viewport, así que el botón no se despega al
 * mover o acercar. Su contenedor no recibe puntero —para no robar clics al
 * lienzo—, y por eso el botón se lo devuelve a sí mismo en la hoja de estilos.
 */
export function DeletableEdge(props: EdgeProps<CanvasEdge>) {
  const { deleteElements } = useReactFlow();
  const { id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, selected } = props;

  const [, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition
  });

  return (
    <>
      <BezierEdge {...props} />
      {selected && (
        <EdgeLabelRenderer>
          <button
            type="button"
            // `nodrag`/`nopan`: sin ellas, pulsar el botón arrastraría el
            // lienzo por debajo. Son las clases que React Flow reconoce.
            className="canvas-edge-delete nodrag nopan"
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
            title="Eliminar conexión"
            aria-label="Eliminar conexión"
            onClick={(event) => {
              // El clic no debe llegar al lienzo: allí deseleccionaría, y la
              // deselección compite con el borrado que se acaba de pedir.
              event.stopPropagation();

              // La API del propio React Flow. Emite el cambio `remove` por
              // `onEdgesChange`, que es por donde ya pasan todos los cambios de
              // aristas: la lista de `useCanvasEdges` sigue siendo la única
              // fuente de verdad y el autoguardado se entera solo.
              void deleteElements({ edges: [{ id }] });
            }}
          >
            <TrashIcon />
          </button>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
