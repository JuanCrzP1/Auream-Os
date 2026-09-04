interface SendOnceSwitchProps {
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
  /** Para que la etiqueta accesible diga de qué bloque es. */
  readonly position: number;
}

/**
 * «Enviar una sola vez» de un bloque multimedia.
 *
 * Lo comparten los cuatro tipos. El acento sale del bloque (`--mi-accent`), así
 * que encendido se ve índigo en Imagen, magenta en Video, cian en Audio y teal
 * en Archivo sin que este componente sepa de tipos.
 *
 * `role="switch"` con `aria-checked`, no una casilla: para un lector es un
 * interruptor —encendido o apagado— y no un elemento de una lista de opciones
 * marcables.
 *
 * EL DATO SÍ SE GUARDA; el comportamiento todavía no existe. El motor no lleva
 * registro de lo que ya envió a cada conversación, así que hoy nadie lee este
 * campo. Se persiste bien modelado para que el día que ese registro exista no
 * haya que migrar nada ni volver a preguntárselo al usuario.
 */
export function SendOnceSwitch({ checked, onChange, position }: SendOnceSwitchProps) {
  return (
    <div className="send-once">
      <span className="send-once__label" id={`send-once-label-${position}`}>
        Enviar una sola vez
      </span>

      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={`send-once-label-${position}`}
        className={`send-once__switch nodrag${checked ? " send-once__switch--on" : ""}`}
        onClick={() => onChange(!checked)}
      >
        <span className="send-once__knob" aria-hidden="true" />
      </button>
    </div>
  );
}
