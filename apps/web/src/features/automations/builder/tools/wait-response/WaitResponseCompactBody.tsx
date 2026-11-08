import {
  WAIT_RESPONSE_OUTPUT,
  hasWaitResponseTimeout,
  readWaitResponseConfig
} from "@contracts/WaitResponseConfig";
import type { ToolCompactProps } from "../ToolUi";
import type { ToolOutput } from "../ToolDefinition";
import { OutputHandle } from "../_kit/OutputHandle";
import { describeWait } from "./summarizeWaitResponse";

/** Texto del nodo cuando no lleva mensaje propio. */
export const NO_PROMPT_TEXT = "Esperar la respuesta del cliente";

function ClockIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="8" cy="8.5" r="5.5" />
      <path d="M8 5.75v2.75l1.9 1.4" />
    </svg>
  );
}

function InfinityIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
      <path d="M5.1 5.6a2.9 2.9 0 1 0 0 4.8L10.9 5.6a2.9 2.9 0 1 1 0 4.8z" />
    </svg>
  );
}

/**
 * Una salida: mini tarjeta y punto. `.wr-out` es solo el ancla de posición del
 * handle; el aspecto vive en `.wr-out__card`, hermano del handle.
 */
function Output({ output }: { readonly output: ToolOutput }) {
  const tone = output.id === WAIT_RESPONSE_OUTPUT.timeout ? "tiempo" : "respuesta";

  return (
    <li className={`wr-out wr-out--${tone}`}>
      <span className="wr-out__card">
        <span className="wr-out__dot" aria-hidden="true" />
        <span className="wr-out__label">{output.label}</span>
      </span>
      <OutputHandle id={output.id} className="wr-out__handle" />
    </li>
  );
}

/**
 * Nodo «Esperar respuesta» cerrado: qué se pregunta, cuánto se espera y por
 * dónde sigue. Las salidas las calcula el núcleo con `outputs()`.
 */
export function WaitResponseCompactBody({ draft, outputs = [] }: ToolCompactProps) {
  const config = readWaitResponseConfig(draft.config);
  const prompt = typeof draft.content.text === "string" ? draft.content.text.trim() : "";
  const limited = hasWaitResponseTimeout(config);

  return (
    <div className="wr-node">
      <p className={`wr-node__prompt${prompt.length === 0 ? " wr-node__prompt--empty" : ""}`}>
        {prompt.length > 0 ? prompt : NO_PROMPT_TEXT}
      </p>

      <p className="wr-node__wait">
        <span className="wr-node__chip">
          <span className="wr-node__wait-icon" aria-hidden="true">
            {limited ? <ClockIcon /> : <InfinityIcon />}
          </span>
          <span className="wr-node__wait-text">
            {limited ? `Máximo: ${describeWait(config)}` : "Sin límite"}
          </span>
        </span>
        {config.targetKey ? (
          <span className="wr-node__target" title={`Guarda la respuesta en ${config.targetKey}`}>
            ↳ {config.targetKey}
          </span>
        ) : null}
      </p>

      <div className="wr-node__outputs">
        <span className="wr-node__outputs-title">
          {outputs.length > 1 ? "Resultados" : "Resultado"}
        </span>
        <ul className="wr-node__outputs-list">
          {outputs.map((output) => (
            <Output key={output.id} output={output} />
          ))}
        </ul>
      </div>
    </div>
  );
}
