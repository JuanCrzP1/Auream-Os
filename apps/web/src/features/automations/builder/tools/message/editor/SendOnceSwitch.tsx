import { SwitchControl } from "../../_kit/Switch";

interface SendOnceSwitchProps {
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
  /** Para que la etiqueta accesible sea única por bloque. */
  readonly position: number;
  /** Otro interruptor con la misma forma («Ver una sola vez»). */
  readonly id?: string;
  readonly label?: string;
  readonly hint?: string;
}

/**
 * «Enviar una sola vez» de un bloque multimedia (y, con la misma forma, «Ver
 * una sola vez»). El acento sale del bloque (`--mi-accent`).
 */
export function SendOnceSwitch({ checked, onChange, position, id = "send-once", label = "Enviar una sola vez", hint }: SendOnceSwitchProps) {
  const labelId = `${id}-label-${position}`;

  return (
    <div className="send-once">
      <span className="send-once__text">
        <span className="send-once__label" id={labelId}>
          {label}
        </span>
        {hint ? <span className="send-once__hint">{hint}</span> : null}
      </span>
      <SwitchControl checked={checked} onChange={onChange} labelledBy={labelId} />
    </div>
  );
}
