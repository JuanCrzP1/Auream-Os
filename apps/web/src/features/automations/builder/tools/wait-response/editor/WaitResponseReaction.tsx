import { WaitResponseSwitch } from "./WaitResponseSwitch";

interface WaitResponseReactionProps {
  /** El emoji configurado. Ausente o vacío = no se reacciona. */
  readonly reaction: string | undefined;
  readonly onChange: (reaction: string | undefined) => void;
}

/**
 * Emoji por defecto al encender la reacción.
 *
 * Encender el interruptor tiene que dejar el nodo en un estado que ya funcione:
 * quedarse esperando a que el usuario elija habría dejado guardada una reacción
 * sin emoji, que en el contrato significa «no reacciones».
 */
const EMOJI_INICIAL = "👍";

/**
 * Los emoji ofrecidos.
 *
 * Una fila corta y cerrada, no un selector de emoji: la reacción a una respuesta
 * es un acuse —«recibido», «gracias», «hecho»— y para eso sobra con estos. Un
 * selector completo sería una pieza de interfaz mucho mayor que la decisión que
 * resuelve. El contrato admite cualquier cadena, así que ampliar esta lista no
 * exige tocar ni el modelo ni el motor.
 */
const EMOJIS: ReadonlyArray<string> = ["👍", "❤️", "🙌", "✅", "😊", "🙏"];

/**
 * Reaccionar al mensaje que el cliente envía como respuesta.
 *
 * Es UN SOLO DATO —el emoji— presentado como dos gestos: encenderlo y elegir
 * cuál. Por eso no hay un booleano en la configuración: el estado «encendido»
 * ES tener emoji, y así no pueden contradecirse un interruptor a `true` y un
 * emoji vacío.
 *
 * EL INTERRUPTOR ES `WaitResponseSwitch`, no una copia suya. Antes este archivo
 * repetía su marcado entero —contenedor, rótulo, pista, botón `role="switch"`,
 * pulsador y las mismas clases—, así que había dos implementaciones del mismo
 * control accesible en la misma carpeta: arreglar una accesibilidad o un estilo
 * en el interruptor no llegaba aquí, en silencio.
 *
 * Lo único que este componente aporta sobre el interruptor es la TRADUCCIÓN
 * entre encendido/apagado y emoji/ausencia, que es su responsabilidad real y no
 * la del switch: él habla de booleanos porque eso es un interruptor.
 *
 * La fila de emoji solo aparece encendida: apagada no hay nada que elegir.
 */
export function WaitResponseReaction({ reaction, onChange }: WaitResponseReactionProps) {
  const activo = typeof reaction === "string" && reaction.length > 0;

  return (
    <div className="wr-reaction">
      <WaitResponseSwitch
        label="Reaccionar al mensaje recibido"
        hint="Se marca con un emoji la respuesta del cliente."
        checked={activo}
        onChange={(encendido) => onChange(encendido ? EMOJI_INICIAL : undefined)}
      />

      {activo ? (
        <div className="wr-reaction__picker" role="radiogroup" aria-label="Emoji de la reacción">
          {EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              role="radio"
              aria-checked={emoji === reaction}
              aria-label={`Reaccionar con ${emoji}`}
              className={`wr-reaction__emoji nodrag${
                emoji === reaction ? " wr-reaction__emoji--active" : ""
              }`}
              onClick={() => onChange(emoji)}
            >
              {emoji}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
