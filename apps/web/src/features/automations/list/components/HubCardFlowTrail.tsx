import { useId } from "react";

/**
 * La culebra de luz que recorre el borde de una tarjeta de automatización.
 *
 * UN SOLO TRAZO. El `<rect>` es el perímetro redondeado de la tarjeta —un
 * trazado real, no un rectángulo girando— y la luz es un tramo de SU PROPIO
 * trazo, dibujado con `stroke-dasharray`. Por eso dobla las esquinas: no hay
 * ningún cuerpo rígido que gire, hay un trazo que sigue la curva porque ES la
 * curva.
 *
 * `pathLength="100"` renormaliza la longitud del trazado a 100 unidades, así
 * que el tramo se declara en porcentaje del perímetro y mide lo mismo en
 * proporción tanto en una tarjeta estrecha como en una ancha. Sin esto habría
 * que recalcular el guion por cada ancho de columna.
 *
 * El degradado necesita un `id` y en el Hub hay muchas tarjetas: `useId` le da
 * uno propio a cada una en lugar de repetir el mismo identificador por el
 * documento. Es lo único que no puede vivir en la hoja de estilos.
 *
 * Decorativo y nada más: sin foco, sin nombre accesible y sin puntero.
 */
export function HubCardFlowTrail() {
  const gradiente = `hub-card-flow-${useId()}`;

  return (
    <svg className="hub-card-flow" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={gradiente} x1="0%" y1="0%" x2="100%" y2="35%">
          <stop offset="0%" stopColor="var(--hub-card-flow-from)" />
          <stop offset="50%" stopColor="var(--hub-card-flow-mid)" />
          <stop offset="100%" stopColor="var(--hub-card-flow-to)" />
        </linearGradient>
      </defs>
      <rect
        className="hub-card-flow__trail"
        x="0"
        y="0"
        width="100%"
        height="100%"
        rx="16"
        pathLength="100"
        stroke={`url(#${gradiente})`}
      />
    </svg>
  );
}
