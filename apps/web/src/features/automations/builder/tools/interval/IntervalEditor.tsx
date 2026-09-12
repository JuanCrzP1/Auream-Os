import "./interval-editor.css";
import {
  readIntervalConfig,
  type IntervalConfig,
  type IntervalTrigger
} from "@contracts/IntervalConfig";
import type { ToolEditorProps } from "../ToolUi";
import { explicarIntervalo } from "./summarizeInterval";
import { validateInterval } from "./validateInterval";
import { IntervalTriggerPicker } from "./editor/IntervalTriggerPicker";
import { IntervalScheduleToggle } from "./editor/IntervalScheduleToggle";
import { IntervalWaitFields } from "./editor/IntervalWaitFields";
import { IntervalDateFields } from "./editor/IntervalDateFields";
import { IntervalScheduleFields } from "./editor/IntervalScheduleFields";

/**
 * Configuración de un «Programador».
 *
 * SOLO COMPONE. Elige qué momento principal se está editando y monta sus
 * campos; no sabe qué es una franja válida, ni cuánto dura una espera, ni cómo
 * se cuenta un día. Todo eso vive en el contrato, en `intervalSchedule` y en
 * `validateInterval`, y por eso este archivo no crece cuando el dominio se
 * complica.
 *
 * LA PANTALLA TIENE DOS PARTES PORQUE EL DOMINIO TIENE DOS COSAS:
 *
 *   · ARRIBA, EL MOMENTO PRINCIPAL. Dos pestañas excluyentes —una espera o una
 *     cita— y los campos de la elegida. Es lo que decide CUÁNDO continuar, y
 *     siempre hay uno.
 *   · ABAJO, LA RESTRICCIÓN HORARIA. Un interruptor, no una tercera pestaña,
 *     porque no sustituye a nada: se suma a lo de arriba. Encendido despliega
 *     sus días; apagado no ocupa sitio.
 *
 * ESA FORMA ES LA REGLA DE NEGOCIO DIBUJADA. Mientras fueron tres pestañas
 * iguales, la interfaz afirmaba que elegir horario cancelaba la espera —y no
 * es así—, de modo que el usuario no tenía manera de pedir «dentro de cinco
 * minutos, pero solo en horario de oficina», que es justo el caso corriente.
 *
 * SIN ESTADO PROPIO. La configuración se lee en cada render desde
 * `draft.config`. Con una copia en `useState` habría dos verdades sobre lo
 * mismo y bastaría con cancelar, cerrar y reabrir para que divergieran. El
 * borrador acumulado vive en `NodeExpandedFrame`, que es el único dueño de «lo
 * editado y no confirmado»: Guardar y Cancelar son suyos y aquí no se
 * reimplementan.
 *
 * TODO CONVIVE EN LA CONFIGURACIÓN. Cambiar de momento principal no borra lo
 * configurado en el otro —volver atrás lo devuelve— y apagar el horario no
 * borra sus días; eso es posible sin ninguna memoria paralela porque el propio
 * contrato guarda las tres piezas a la vez. `trigger` dice cuál de los dos
 * momentos gobierna y `scheduleEnabled` si el horario cuenta.
 *
 * NO IMPORTA NADA DE OTRA HERRAMIENTA. Ni Mensaje, ni Esperar respuesta, ni
 * Distribuidor: lo único que comparten es el marco genérico que las contiene y
 * el contrato que implementan.
 */
export function IntervalEditor({ draft, onChange }: ToolEditorProps) {
  const config = readIntervalConfig(draft.config);
  const validez = validateInterval(draft.content, draft.config);
  const explicacion = explicarIntervalo(config);

  /**
   * Publica una configuración nueva conservando el resto del borrador.
   *
   * Los cinco campos propios se apartan del volcado para que lo que se emite
   * sea lo único que queda: `applyNodePatch` reemplaza el objeto entero, así
   * que volcar `...draft.config` encima devolvería los valores viejos. Lo que
   * queda en `resto` es lo que otra versión hubiera guardado y esta no conoce;
   * eso sí se conserva íntegro.
   *
   * `mode` SE APARTA AUNQUE YA NO SE ESCRIBA: es el campo de la versión
   * anterior, y dejarlo pasar en `resto` guardaría un modo viejo junto al
   * `trigger` nuevo. Al primer guardado, un nodo heredado se queda con la forma
   * de hoy y sin el rastro de ayer.
   */
  const publicar = (parche: Partial<IntervalConfig>) => {
    const siguiente: IntervalConfig = { ...config, ...parche };
    const {
      mode: _m,
      trigger: _t,
      wait: _w,
      moment: _mo,
      scheduleEnabled: _se,
      schedule: _s,
      ...resto
    } = draft.config;

    onChange({
      config: {
        ...resto,
        trigger: siguiente.trigger,
        wait: siguiente.wait,
        moment: siguiente.moment,
        scheduleEnabled: siguiente.scheduleEnabled,
        schedule: siguiente.schedule
      }
    });
  };

  return (
    <div className="interval">
      {/* LA PREGUNTA, antes que los campos. El editor no empieza pidiendo un
          número: empieza preguntando qué clase de espera es esta, porque de la
          respuesta depende todo lo demás. */}
      <h3 className="interval__label">¿Cuándo debe continuar?</h3>

      {/* UNA SOLA PIEZA: las dos secciones arriba y la configuración dentro.
          Las pestañas no flotan sobre el panel —son su borde superior—, y por
          eso el marcado las mete aquí dentro en vez de dejarlas como una fila
          aparte con un filo entre medias. */}
      <div className="iv-panel">
        <IntervalTriggerPicker
          value={config.trigger}
          onChange={(trigger: IntervalTrigger) => publicar({ trigger })}
        />

        {/* Solo los campos del momento elegido. El otro no se pinta
            deshabilitado insinuando que hace algo: no gobierna este nodo.

            La `key` es el momento, y no es decorativa: obliga a React a montar
            de nuevo al cambiar de sección, que es lo que dispara la transición
            de entrada de la hoja. Sin ella, pasar de espera a fecha
            reutilizaría el mismo nodo y el cambio ocurriría de golpe. */}
        <div className="iv-panel__body" key={config.trigger}>
          {config.trigger === "interval" ? (
            <IntervalWaitFields wait={config.wait} onChange={(wait) => publicar({ wait })} />
          ) : (
            <IntervalDateFields
              moment={config.moment}
              onChange={(moment) => publicar({ moment })}
            />
          )}
        </div>
      </div>

      {/* LA RESTRICCIÓN, DEBAJO Y APARTE. Fuera del panel a propósito: lo de
          arriba es una elección entre dos, esto es un sí o un no sobre lo
          elegido, y meterlo dentro volvería a mezclar las dos naturalezas.

          LOS DÍAS SOLO EXISTEN SI EL INTERRUPTOR ESTÁ ENCENDIDO. Apagado no se
          pintan deshabilitados ocupando media pantalla: no se pintan. Lo
          configurado no se pierde —sigue en la configuración— y vuelve intacto
          al encenderlo otra vez. */}
      <div className="iv-extra">
        <IntervalScheduleToggle
          value={config.scheduleEnabled}
          onChange={(scheduleEnabled) => publicar({ scheduleEnabled })}
        />

        {config.scheduleEnabled ? (
          <IntervalScheduleFields
            schedule={config.schedule}
            onChange={(schedule) => publicar({ schedule })}
          />
        ) : null}
      </div>

      {/* LA CONFIRMACIÓN, y SOLO la confirmación. Sale de la configuración
          real, nunca de un texto escrito a mano: si mañana cambia cómo se
          cuenta una espera, esta frase cambia con ella.

          EL MOTIVO DEL RECHAZO NO SE PINTA AQUÍ. Lo da el marco compartido, y
          lo da cuando el usuario INTENTA guardar —no mientras construye—:
          señalarle que le falta la hora en cuanto abre el modo fecha sería
          regañarle por no haber terminado todavía. Esa decisión ya está tomada
          en `NodeExpandedFrame` y repetirla aquí la contradiría además de
          duplicarla. Lo que esta herramienta sí hace es callar mientras lo
          configurado no signifique nada. */}
      {validez.valido && explicacion !== null ? (
        <p className="interval__summary" role="status">
          {explicacion}
        </p>
      ) : null}
    </div>
  );
}
