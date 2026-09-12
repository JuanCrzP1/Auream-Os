import { useId } from "react";
import { IconoHorario } from "../intervalModeIcons";

interface IntervalScheduleToggleProps {
  readonly value: boolean;
  readonly onChange: (activo: boolean) => void;
}

/**
 * El interruptor del horario permitido.
 *
 * ES UN INTERRUPTOR Y NO UNA PESTAÑA, y esa es toda la diferencia de modelo: no
 * compite con «Después» ni con «Fecha» —el momento principal sigue siendo el
 * que esté elegido arriba—, sino que AÑADE una condición encima. Encendido, la
 * conversación continúa cuando toque Y esté dentro del horario; apagado, el
 * horario guardado sigue ahí pero no gobierna nada.
 *
 * LA MISMA PALANCA QUE UN DÍA DEL HORARIO. Mismo `<button role="switch">`,
 * mismas clases, mismo botón dentro: son el mismo gesto —encender algo— y
 * darles dos formas distintas obligaría al usuario a aprender dos veces lo
 * mismo. Un `<div>` con `onClick` habría exigido rehacer a mano el foco, el
 * teclado y el rol, y lo habría hecho peor.
 *
 * EL TEXTO ETIQUETA LA PALANCA por `aria-labelledby`, no por proximidad: quien
 * la oye anunciada oye qué enciende.
 *
 * SOLO PRESENTACIÓN: no sabe qué horario hay detrás ni qué se valida cuando se
 * enciende.
 */
export function IntervalScheduleToggle({ value, onChange }: IntervalScheduleToggleProps) {
  const idTitulo = useId();

  return (
    <div className={`iv-toggle${value ? " iv-toggle--on" : ""}`}>
      <span className="iv-toggle__glyph" aria-hidden="true">
        <IconoHorario />
      </span>

      <span className="iv-toggle__text">
        <span className="iv-toggle__title" id={idTitulo}>
          Solo en horario permitido
        </span>
        {/* Qué pasa si se deja como está. Dice la CONSECUENCIA, no repite el
            rótulo: quien duda entre encenderlo y no, lo que necesita saber es
            eso. */}
        <span className="iv-toggle__hint">
          {value ? "Esperará al siguiente tramo abierto." : "Continuará a cualquier hora."}
        </span>
      </span>

      <button
        type="button"
        role="switch"
        aria-checked={value}
        aria-labelledby={idTitulo}
        className={`iv-switch nodrag${value ? " iv-switch--on" : ""}`}
        onClick={() => onChange(!value)}
      >
        <span className="iv-switch__knob" aria-hidden="true" />
      </button>
    </div>
  );
}
