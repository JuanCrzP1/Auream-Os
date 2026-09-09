import { useId } from "react";
import type { WaitResponseTimeUnit } from "@contracts/WaitResponseConfig";

interface WaitResponseTimeoutProps {
  readonly amount: number;
  readonly unit: WaitResponseTimeUnit;
  readonly onChange: (amount: number, unit: WaitResponseTimeUnit) => void;
}

/**
 * Las dos unidades que la herramienta ofrece, con su nombre visible.
 *
 * Se declaran aquí y no en el contrato porque son PRESENTACIÓN: el contrato
 * decide qué unidades existen (`WaitResponseTimeUnit`), esta lista decide cómo
 * se llaman en pantalla. Si mañana el producto habla en otro idioma, cambia
 * esto y no el contrato.
 */
const UNIDADES: ReadonlyArray<{ readonly value: WaitResponseTimeUnit; readonly label: string }> = [
  { value: "minutes", label: "Minutos" },
  { value: "hours", label: "Horas" }
];

/**
 * Cuánto se espera como máximo: una cantidad y su unidad.
 *
 * Solo se monta cuando «Esperar sin límite» está apagado — `WaitResponseEditor`
 * decide eso; aquí no se sabe nada de esa opción.
 *
 * DOS BOTONES Y NO UN `<select>`: el menú desplegado de un `select` lo pinta el
 * sistema operativo y no hay CSS que lo alcance, así que en tema oscuro se abre
 * como un agujero blanco. Con dos unidades, un grupo de opciones visibles es
 * además menos clics que un desplegable. `role="radiogroup"` para que un lector
 * de pantalla las anuncie como lo que son: una elección entre dos.
 *
 * La cantidad se acota en la ENTRADA —entera y mayor que cero— porque una
 * espera de cero o negativa no significa nada. La validación vuelve a
 * comprobarlo sobre el dato guardado: este control impide escribirlo, aquella
 * impide guardarlo si llegó por otro camino.
 */
export function WaitResponseTimeout({ amount, unit, onChange }: WaitResponseTimeoutProps) {
  const idCantidad = useId();

  return (
    <div className="wr-timeout">
      <label className="wr-timeout__label" htmlFor={idCantidad}>
        Tiempo máximo
      </label>

      <div className="wr-timeout__controls">
        <input
          id={idCantidad}
          type="number"
          min={1}
          step={1}
          className="wr-timeout__amount nodrag"
          value={amount}
          onChange={(evento) => {
            const valor = Number(evento.target.value);
            const entero = Math.floor(valor);
            onChange(Number.isFinite(entero) && entero > 0 ? entero : 1, unit);
          }}
        />

        <div className="wr-timeout__units" role="radiogroup" aria-label="Unidad del tiempo máximo">
          {UNIDADES.map((unidad) => (
            <button
              key={unidad.value}
              type="button"
              role="radio"
              aria-checked={unidad.value === unit}
              className={`wr-timeout__unit nodrag${
                unidad.value === unit ? " wr-timeout__unit--active" : ""
              }`}
              onClick={() => onChange(amount, unidad.value)}
            >
              {unidad.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
