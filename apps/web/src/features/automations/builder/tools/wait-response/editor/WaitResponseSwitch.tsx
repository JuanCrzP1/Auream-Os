import { useId } from "react";

interface WaitResponseSwitchProps {
  readonly label: string;
  readonly hint?: string;
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
}

/**
 * Interruptor de una opción de la espera.
 *
 * `role="switch"` con `aria-checked`, no una casilla: para un lector de pantalla
 * esto es un encendido/apagado, no un elemento marcable de una lista.
 *
 * POR QUÉ NO REUTILIZA `SendOnceSwitch` DE MENSAJE: aquel vive en
 * `tools/message/editor/`, se pinta con la hoja de Mensaje y toma su color del
 * acento del bloque multimedia que lo contiene (`--mi-accent`). Importarlo aquí
 * ataría Esperar respuesta a la herramienta Mensaje —exactamente la dependencia
 * que no debe existir— y traería un color que no es el suyo. Son dos
 * interruptores parecidos en dos herramientas independientes; con un tercer caso
 * habrá material para decidir qué es de verdad común, y hasta entonces
 * extraerlo sería escribir un componente compartido a partir de un solo
 * ejemplo, que es como se deforman.
 */
export function WaitResponseSwitch({ label, hint, checked, onChange }: WaitResponseSwitchProps) {
  const idEtiqueta = useId();
  const idPista = useId();

  return (
    <div className="wr-switch">
      <div className="wr-switch__text">
        <span className="wr-switch__label" id={idEtiqueta}>
          {label}
        </span>
        {hint ? (
          <span className="wr-switch__hint" id={idPista}>
            {hint}
          </span>
        ) : null}
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={idEtiqueta}
        aria-describedby={hint ? idPista : undefined}
        className={`wr-switch__control nodrag${checked ? " wr-switch__control--on" : ""}`}
        onClick={() => onChange(!checked)}
      >
        <span className="wr-switch__knob" aria-hidden="true" />
      </button>
    </div>
  );
}
