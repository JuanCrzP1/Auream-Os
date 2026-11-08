import { SwitchField } from "../../_kit/Switch";

interface WaitResponseReactionProps {
  /** Emoji configurado. Ausente o vacío = no se reacciona. */
  readonly reaction: string | undefined;
  readonly onChange: (reaction: string | undefined) => void;
}

/** Al encender, el nodo debe quedar funcionando: se propone un emoji. */
const DEFAULT_EMOJI = "👍";

/** Fila corta de acuses. El contrato admite cualquier cadena. */
const EMOJIS: ReadonlyArray<string> = ["👍", "❤️", "🙌", "✅", "😊", "🙏"];

/**
 * Reacción al mensaje del cliente. Un solo dato —el emoji— en dos gestos:
 * «encendido» ES tener emoji, así que no hay booleano que pueda contradecirlo.
 */
export function WaitResponseReaction({ reaction, onChange }: WaitResponseReactionProps) {
  const active = typeof reaction === "string" && reaction.length > 0;

  return (
    <div className="wr-reaction">
      <SwitchField
        label="Reaccionar al mensaje recibido"
        hint="Se marca con un emoji la respuesta del cliente."
        checked={active}
        onChange={(on) => onChange(on ? DEFAULT_EMOJI : undefined)}
      />

      {active ? (
        <div className="wr-reaction__picker" role="radiogroup" aria-label="Emoji de la reacción">
          {EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              role="radio"
              aria-checked={emoji === reaction}
              aria-label={`Reaccionar con ${emoji}`}
              className={`wr-reaction__emoji nodrag${emoji === reaction ? " wr-reaction__emoji--active" : ""}`}
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
