import {
  BaseEdge,
  BezierEdge,
  EdgeLabelRenderer,
  getBezierPath,
  useInternalNode,
  useReactFlow,
  type EdgeProps
} from "@xyflow/react";
import { TrashIcon } from "@features/automations/shared/TrashIcon";
import type { CanvasEdge } from "@features/automations/builder/types/canvas";
import { selfLoopPath } from "./selfLoopPath";

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
 *
 * LA CONEXIÓN QUE VUELVE A SU BLOQUE («Otra respuesta» del Menú → el mismo
 * Menú, como en Leona) es la única excepción al bézier: una curva de la salida
 * a la entrada del mismo bloque lo atravesaría. Se dibuja como un lazo por
 * debajo del bloque (`selfLoopPath`) con `BaseEdge`, el mismo trazo base de
 * React Flow, así que conserva estilo, etiqueta y selección.
 *
 * UNA CONEXIÓN PERFECTAMENTE HORIZONTAL (dos bloques a la misma altura) tiene
 * una caja de alto 0, y el navegador NO pinta un degradado sobre una caja así
 * (`objectBoundingBox`): la línea desaparecía. Se corre su llegada un píxel,
 * invisible a la vista, para que siempre tenga alto.
 */
/** Trazo de la conexión seleccionada: más grueso que el normal (2.3) y con halo. */
const SELECTED_STROKE_WIDTH = 3.6;
const SELECTED_GLOW = "drop-shadow(0 0 6px var(--primary-soft))";

export function DeletableEdge(props: EdgeProps<CanvasEdge>) {
  const { deleteElements } = useReactFlow();
  const { id, source, target, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, selected } = props;
  const loopNode = useInternalNode(source);
  const selfLoop = source === target;
  const flat = !selfLoop && Math.abs(sourceY - targetY) < 1;
  const strokeStyle = selected ? { ...props.style, strokeWidth: SELECTED_STROKE_WIDTH, filter: SELECTED_GLOW } : props.style;

  const loop = selfLoop
    ? selfLoopPath({
        sourceX,
        sourceY,
        targetX,
        targetY,
        bottom: loopNode ? loopNode.internals.positionAbsolute.y + (loopNode.measured.height ?? 0) : Math.max(sourceY, targetY)
      })
    : null;
  const [, bezierLabelX, bezierLabelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition
  });
  const labelX = loop ? loop.labelX : bezierLabelX;
  const labelY = loop ? loop.labelY : bezierLabelY;

  return (
    <>
      {/* Seleccionada (B14): trazo más grueso y con halo. Se decide aquí, en la
          presentación de la arista, porque su `style` en línea gana a cualquier
          hoja de estilos. */}
      {loop ? (
        <BaseEdge
          id={id}
          path={loop.path}
          labelX={loop.labelX}
          labelY={loop.labelY}
          {...(props.label !== undefined ? { label: props.label } : {})}
          {...(props.labelStyle ? { labelStyle: props.labelStyle } : {})}
          {...(props.labelShowBg !== undefined ? { labelShowBg: props.labelShowBg } : {})}
          {...(props.labelBgStyle ? { labelBgStyle: props.labelBgStyle } : {})}
          {...(props.labelBgPadding ? { labelBgPadding: props.labelBgPadding } : {})}
          {...(props.labelBgBorderRadius !== undefined ? { labelBgBorderRadius: props.labelBgBorderRadius } : {})}
          {...(props.markerEnd ? { markerEnd: props.markerEnd } : {})}
          {...(props.markerStart ? { markerStart: props.markerStart } : {})}
          {...(props.interactionWidth !== undefined ? { interactionWidth: props.interactionWidth } : {})}
          {...(strokeStyle ? { style: strokeStyle } : {})}
        />
      ) : (
        <BezierEdge {...props} {...(flat ? { targetY: targetY + 1 } : {})} {...(strokeStyle ? { style: strokeStyle } : {})} />
      )}
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
