import { useId } from "react";
import type { IntervalMoment } from "@contracts/IntervalConfig";
import { IntervalTimeControl } from "./IntervalTimeControl";

interface IntervalDateFieldsProps {
  readonly moment: IntervalMoment | null;
  readonly onChange: (moment: IntervalMoment) => void;
}

/**
 * Momento principal «en una fecha»: el día y la hora en que continuar.
 *
 * DOS CONTROLES DE DISTINTA NATURALEZA, y es deliberado:
 *
 *   · EL DÍA SIGUE SIENDO NATIVO. `<input type="date">` funciona: produce
 *     `YYYY-MM-DD` sin conversión alguna y trae el calendario, la localización
 *     y el teclado del móvil resueltos por el sistema. Reescribir un calendario
 *     a mano sería rehacer todo eso peor por simetría.
 *   · LA HORA NO ES UN CAMPO, SON TRES. `IntervalTimeControl`: hora, minutos y
 *     la mitad del día, cada uno con su dominio. Lo que se guarda sigue siendo
 *     `HH:mm` de veinticuatro.
 *
 * EL DÍA ESTÁ CONTROLADO, Y AQUÍ ESTUVO EL FALLO DE GUARDAR.
 *
 * Este campo fue `defaultValue`, o sea NO CONTROLADO, y eso lo convertía en una
 * SEGUNDA FUENTE DE VERDAD que React no podía corregir. El marco del nodo
 * resincroniza su borrador cuando el nodo cambia de valor —cualquier escritura
 * sobre él sirve—, y en ese momento el borrador volvía a la fecha guardada
 * mientras el DOM seguía enseñando la que la persona acababa de elegir. De ahí
 * salía el síntoma exacto que había que explicar: en pantalla «11/09/2026», en
 * el borrador otra cosa, y Guardar deshabilitado o quejándose de una fecha
 * incompleta que sí se estaba viendo.
 *
 * Con `value` hay UNA sola verdad: el borrador. Si el borrador retrocede, el
 * campo retrocede con él y la persona lo ve. Escribir a medias no lo rompe —un
 * día incompleto vale `""` y React no reescribe el DOM cuando el valor no
 * cambia, así que los segmentos a medio teclear se quedan donde están—.
 *
 * SIN FECHA NO SE INVENTA NINGUNA. Con `moment` en `null` los dos controles
 * salen vacíos: ni hoy, ni mañana.
 *
 * LOS DOS CAMPOS SON INDEPENDIENTES. Cada uno conserva al otro al publicar, y
 * lo lee de la CONFIGURACIÓN y no del DOM: escribir la hora no puede borrar el
 * día que ya estaba puesto, ni al revés.
 */
export function IntervalDateFields({ moment, onChange }: IntervalDateFieldsProps) {
  const idFecha = useId();

  return (
    <div className="iv-date">
      <span className="iv-field__label">Continuar el</span>

      <div className="iv-date__controls">
        <div className="iv-date__field">
          <label className="iv-date__caption" htmlFor={idFecha}>
            Fecha
          </label>
          <input
            id={idFecha}
            type="date"
            className="iv-date__input nodrag nowheel"
            aria-label="Fecha"
            value={moment?.date ?? ""}
            onChange={(evento) =>
              onChange({ date: evento.target.value, time: moment?.time ?? "" })
            }
          />
        </div>

        <div className="iv-date__field">
          <span className="iv-date__caption">Hora</span>
          <IntervalTimeControl
            label="Hora a la que continuar"
            value={moment?.time ?? ""}
            onChange={(time) => onChange({ date: moment?.date ?? "", time })}
          />
        </div>
      </div>
    </div>
  );
}
