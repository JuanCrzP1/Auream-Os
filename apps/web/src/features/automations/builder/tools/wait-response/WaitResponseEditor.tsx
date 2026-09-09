import "./wait-response-editor.css";
import { useId, useState } from "react";
import {
  WAIT_RESPONSE_DEFAULT_TIMEOUT,
  readWaitResponseConfig,
  type WaitResponseConfig,
  type WaitResponseTimeout as WaitResponseTimeoutValue,
  type WaitResponseTimeUnit
} from "@contracts/WaitResponseConfig";
import type { ToolEditorProps } from "../ToolUi";
import { WaitResponseSwitch } from "./editor/WaitResponseSwitch";
import { WaitResponseTimeout } from "./editor/WaitResponseTimeout";
import { WaitResponseReaction } from "./editor/WaitResponseReaction";

/**
 * Configuración de un «Esperar respuesta».
 *
 * Recibe el borrador y una devolución de llamada; no conoce el nodo, ni el
 * lienzo, ni React Flow, ni el snapshot, ni la persistencia. Todo lo que puede
 * hacer es proponer un `content`/`config` nuevos — el contrato `ToolEditorProps`
 * no le da con qué hacer otra cosa.
 *
 * SIN ESTADO PROPIO PARA LA CONFIGURACIÓN. Se lee en cada render desde
 * `draft.config` a través de `readWaitResponseConfig`. Con estado local para
 * esto habría dos verdades sobre lo mismo —la del editor y la del nodo— y
 * bastaría con cancelar, cerrar y reabrir para que divergieran. El borrador
 * acumulado vive en `NodeExpandedFrame`, que es el único dueño de «lo editado y
 * no confirmado».
 *
 * LA ÚNICA EXCEPCIÓN es `ultimoTimeout`, más abajo: memoria de gesto, no
 * configuración. Existe porque apagar «sin límite» BORRA el tiempo máximo del
 * `config` persistido —dejarlo escrito sería la contradicción que
 * `validateWaitResponse` rechaza—, y sin recordarlo en algún sitio, encender y
 * apagar el interruptor durante la misma edición devolvía siempre el default
 * del contrato en vez de lo que el usuario ya había escrito. Nunca es una
 * segunda fuente de verdad: no se lee para pintar nada mientras el tiempo
 * máximo está visible —eso sigue siendo `draft.config`—, solo se consulta al
 * volver a apagar el interruptor, y se resincroniza con cada edición real del
 * control.
 *
 * NO IMPORTA NADA DE MENSAJE. Ni su editor, ni sus controles, ni su hoja de
 * estilos: son dos herramientas independientes y lo único que comparten es el
 * marco genérico que las contiene y el contrato que ambas implementan.
 */
export function WaitResponseEditor({ draft, onChange }: ToolEditorProps) {
  const config = readWaitResponseConfig(draft.config);
  const mensaje = typeof draft.content.text === "string" ? draft.content.text : "";
  const idMensaje = useId();
  const idDestino = useId();

  // Ver la nota de arriba: memoria de gesto para sobrevivir a encender «sin
  // límite» sin perder el tiempo máximo que el usuario ya había escrito. Se
  // siembra con lo que ya hay guardado —o el default del contrato si no hay
  // nada— para que la primera vez que se apague el interruptor no dependa de
  // haber tocado antes el control.
  const [ultimoTimeout, setUltimoTimeout] = useState<WaitResponseTimeoutValue>(
    config.timeout ?? WAIT_RESPONSE_DEFAULT_TIMEOUT
  );

  /** Publica una configuración nueva conservando el resto del borrador. */
  const cambiar = (parche: Partial<WaitResponseConfig>) => {
    const siguiente: WaitResponseConfig = { ...config, ...parche };

    // Los tres campos OPCIONALES se apartan del resto antes de reconstruir.
    //
    // Sin esto no había forma de quitarlos: `applyNodePatch` reemplaza el objeto
    // entero, así que borrar una clave es no emitirla — pero volcando
    // `...draft.config` encima, la clave vieja volvía a entrar y un `timeout`
    // sobrevivía a apagar el límite, que es justo la contradicción que la
    // validación rechaza. Lo que queda en `resto` es lo que otra versión hubiera
    // guardado y esta no conoce: eso sí se conserva íntegro.
    const {
      waitIndefinitely: _wi,
      groupMessages: _gm,
      replyToInbound: _ri,
      timeout: _t,
      reaction: _r,
      targetKey: _tk,
      ...resto
    } = draft.config;

    onChange({
      config: {
        ...resto,
        waitIndefinitely: siguiente.waitIndefinitely,
        groupMessages: siguiente.groupMessages,
        replyToInbound: siguiente.replyToInbound,
        ...(siguiente.timeout ? { timeout: siguiente.timeout } : {}),
        ...(siguiente.reaction ? { reaction: siguiente.reaction } : {}),
        ...(siguiente.targetKey ? { targetKey: siguiente.targetKey } : {})
      }
    });
  };

  return (
    <div className="wait-response">
      {/* MENSAJE ANTES DE ESPERAR — opcional y primero, porque es lo que el
          cliente ve y lo que da sentido a todo lo de abajo. Es `content`, no
          `config`: viaja por el mismo camino que el contenido de cualquier otro
          nodo y lo emite el motor tal cual. */}
      <section className="wait-response__section">
        <label className="wait-response__label" htmlFor={idMensaje}>
          Mensaje antes de esperar
        </label>
        <textarea
          id={idMensaje}
          className="wait-response__textarea nodrag nowheel"
          value={mensaje}
          rows={3}
          placeholder="Opcional: qué se le pregunta al cliente"
          onChange={(evento) => onChange({ content: { ...draft.content, text: evento.target.value } })}
        />
        <p className="wait-response__hint">
          Déjalo vacío si la pregunta ya la hizo un nodo anterior.
        </p>
      </section>

      <hr className="wait-response__rule" />

      {/* LA ESPERA. «Sin límite» manda: con él encendido no hay tiempo máximo
          que configurar, así que el control de tiempo no se pinta en vez de
          quedarse deshabilitado insinuando que hace algo. */}
      <section className="wait-response__section">
        <WaitResponseSwitch
          label="Esperar sin límite"
          hint="La conversación queda a la espera hasta que el cliente responda."
          checked={config.waitIndefinitely}
          onChange={(activo) =>
            cambiar(
              activo
                // Al encender «sin límite» se retira el tiempo del `config`
                // persistido: dejarlo escrito sería la contradicción que la
                // validación rechaza. No se pierde — sigue en `ultimoTimeout`
                // hasta que se vuelva a apagar el interruptor.
                ? { waitIndefinitely: true, timeout: undefined }
                // Al apagarlo se propone lo último que el usuario había
                // configurado, no siempre el default: si nunca tocó el control,
                // `ultimoTimeout` ya nació con ese default.
                : { waitIndefinitely: false, timeout: ultimoTimeout }
            )
          }
        />

        {!config.waitIndefinitely && (
          <WaitResponseTimeout
            // Respaldo para una configuración corrupta: `readWaitResponseConfig`
            // descarta un `timeout` ilegible, y entonces el control necesita algo
            // que enseñar. Mismo default del contrato, no un número suelto.
            amount={config.timeout?.amount ?? WAIT_RESPONSE_DEFAULT_TIMEOUT.amount}
            unit={config.timeout?.unit ?? WAIT_RESPONSE_DEFAULT_TIMEOUT.unit}
            onChange={(amount: number, unit: WaitResponseTimeUnit) => {
              const siguiente = { amount, unit };
              // Se resincroniza la memoria de gesto con cada edición real: si
              // el usuario cambia a 90 minutos y luego enciende y apaga «sin
              // límite», debe reaparecer 90, no el default con el que nació.
              setUltimoTimeout(siguiente);
              cambiar({ timeout: siguiente });
            }}
          />
        )}
      </section>

      <hr className="wait-response__rule" />

      {/* CÓMO SE TRATA LA RESPUESTA. Tres interruptores y un emoji, en el orden
          en que ocurren: primero cómo se recibe, luego cómo se contesta. */}
      <section className="wait-response__section">
        <WaitResponseSwitch
          label="Agrupar mensajes"
          hint="Si el cliente escribe varios mensajes seguidos, se toman como una sola respuesta."
          checked={config.groupMessages}
          onChange={(groupMessages) => cambiar({ groupMessages })}
        />

        <WaitResponseSwitch
          label="Responder al mensaje recibido"
          hint="El mensaje de este bloque se envía citando el último mensaje del cliente."
          checked={config.replyToInbound}
          onChange={(replyToInbound) => cambiar({ replyToInbound })}
        />

        <WaitResponseReaction
          reaction={config.reaction}
          onChange={(reaction) => cambiar({ reaction })}
        />
      </section>

      <hr className="wait-response__rule" />

      {/* DÓNDE QUEDA LA RESPUESTA. El nombre técnico del campo (`targetKey`) no
          aparece por ningún sitio: el usuario nombra el dato, no la clave. */}
      <section className="wait-response__section">
        <label className="wait-response__label" htmlFor={idDestino}>
          Guardar respuesta en
        </label>
        <input
          id={idDestino}
          type="text"
          className="wait-response__input nodrag"
          value={config.targetKey ?? ""}
          placeholder="Opcional: ciudad, correo, presupuesto…"
          autoComplete="off"
          spellCheck={false}
          onChange={(evento) => cambiar({ targetKey: evento.target.value })}
        />
        <p className="wait-response__hint">
          Podrás usar este dato más adelante en el flujo.
        </p>
      </section>
    </div>
  );
}
