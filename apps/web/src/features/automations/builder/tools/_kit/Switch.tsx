import "./kit.css";
import { useId } from "react";

interface SwitchControlProps {
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
  /** Id del elemento que nombra el interruptor. */
  readonly labelledBy: string;
  /** Id del elemento que lo describe, si lo hay. */
  readonly describedBy?: string;
}

/**
 * Interruptor accesible (`role="switch"`), sin rótulo propio.
 *
 * Para composiciones propias (una tarjeta con icono, una fila compacta). El
 * color de encendido lo pone la herramienta con `--kit-switch-accent` (o, más
 * fino, `--kit-switch-on-bg` / `--kit-switch-on-border` / `--kit-switch-off-bg`).
 */
export function SwitchControl({ checked, onChange, labelledBy, describedBy }: SwitchControlProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      className={`kit-switch nodrag${checked ? " kit-switch--on" : ""}`}
      onClick={() => onChange(!checked)}
    >
      <span className="kit-switch__knob" aria-hidden="true" />
    </button>
  );
}

interface SwitchFieldProps {
  readonly label: string;
  readonly hint?: string;
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
}

/** Rótulo, pista opcional e interruptor en una fila. El caso común. */
export function SwitchField({ label, hint, checked, onChange }: SwitchFieldProps) {
  const labelId = useId();
  const hintId = useId();

  return (
    <div className="kit-switch-field">
      <div className="kit-switch-field__text">
        <span className="kit-switch-field__label" id={labelId}>
          {label}
        </span>
        {hint ? (
          <span className="kit-switch-field__hint" id={hintId}>
            {hint}
          </span>
        ) : null}
      </div>
      <SwitchControl
        checked={checked}
        onChange={onChange}
        labelledBy={labelId}
        {...(hint ? { describedBy: hintId } : {})}
      />
    </div>
  );
}
