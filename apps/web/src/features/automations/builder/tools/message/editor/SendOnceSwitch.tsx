import { SwitchControl } from "../../_kit/Switch";

interface SendOnceSwitchProps {
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
  /** Para que la etiqueta accesible sea única por bloque. */
  readonly position: number;
}

/**
 * «Enviar una sola vez» de un bloque multimedia. El acento sale del bloque
 * (`--mi-accent`). El dato se guarda; el motor lo respetará cuando registre lo
 * ya enviado.
 */
export function SendOnceSwitch({ checked, onChange, position }: SendOnceSwitchProps) {
  const labelId = `send-once-label-${position}`;

  return (
    <div className="send-once">
      <span className="send-once__label" id={labelId}>
        Enviar una sola vez
      </span>
      <SwitchControl checked={checked} onChange={onChange} labelledBy={labelId} />
    </div>
  );
}
