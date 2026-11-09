import { useEffect, useRef } from "react";
import { LabMessage } from "./LabMessage";
import { turnInput, waitUntil, type LabTurn } from "./labModel";

/**
 * La conversación de la prueba: lo que escribió el probador (como el cliente)
 * y lo que el flujo le habría respondido, turno a turno. Al final, dónde
 * quedó: esperando respuesta, en una espera (con «Saltar espera»), terminado
 * o con error.
 */
export function LabConversation({
  turns,
  busy,
  blockName,
  onFocusBlock,
  onChoose,
  onSkipWait,
  onStart
}: {
  readonly turns: ReadonlyArray<LabTurn>;
  readonly busy: boolean;
  readonly blockName: (nodeId: string) => string;
  readonly onFocusBlock: (nodeId: string) => void;
  readonly onChoose: (optionId: string, title: string) => void;
  readonly onSkipWait: () => void;
  readonly onStart: () => void;
}) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView?.({ block: "end" });
  }, [turns.length, busy]);

  if (turns.length === 0) {
    return (
      <div className="lab-empty">
        <p className="lab-empty__title">Prueba lo que está en el lienzo</p>
        <p className="lab-empty__text">Escribe como si fueras el cliente y mira, bloque a bloque, qué hace el flujo. Nada se envía por WhatsApp ni toca a tus contactos reales.</p>
        <button type="button" className="ui-btn ui-btn--primary" onClick={onStart} disabled={busy}>
          {busy ? "Iniciando…" : "Iniciar prueba"}
        </button>
      </div>
    );
  }

  const last = turns[turns.length - 1]!;
  const { status, wait, state } = last.response;
  const waitingNode = status === "waiting_reply" ? state.session?.currentNodeId : null;

  return (
    <div className="lab-thread" aria-live="polite">
      {turns.map((turn) => {
        const input = turnInput(turn.event);
        const isLast = turn === last;
        return (
          <div key={turn.id} className="lab-turn">
            {input !== null ? <p className="lab-msg lab-msg--tester">{input}</p> : null}
            {turn.event.type === "skip-wait" ? <p className="lab-divider">Se saltó la espera</p> : null}
            {turn.response.notice ? <p className="lab-notice">{turn.response.notice}</p> : null}
            {turn.response.messages.map((message, index) => (
              <LabMessage
                key={`${turn.id}-${index}`}
                message={message}
                blockName={blockName(message.nodeId)}
                onFocusBlock={() => onFocusBlock(message.nodeId)}
                {...(isLast && message.kind === "menu" && message.nodeId === waitingNode ? { onChoose } : {})}
              />
            ))}
          </div>
        );
      })}

      {busy ? <p className="lab-typing" role="status">El flujo está respondiendo…</p> : null}
      {!busy && waitingNode && !wait ? <p className="lab-divider">Esperando tu respuesta en «{blockName(waitingNode)}»</p> : null}

      {!busy && wait ? (
        <div className="lab-wait">
          <p>{wait.reason === "resume" ? `El Programador continúa ${waitUntil(wait)}` : `Si el cliente no responde, sigue por «Tiempo agotado» ${waitUntil(wait)}`}</p>
          <button type="button" className="ui-btn ui-btn--ghost" onClick={onSkipWait}>
            {wait.reason === "resume" ? "Saltar espera" : "Simular que no responde"}
          </button>
        </div>
      ) : null}

      {!busy && status === "finished" ? (
        <div className="lab-end">
          <p>La prueba terminó: el flujo llegó al final de su camino.</p>
          <button type="button" className="ui-btn ui-btn--ghost" onClick={onStart}>Probar de nuevo</button>
        </div>
      ) : null}
      {!busy && status === "failed" ? (
        <div className="lab-end lab-end--failed" role="alert">
          <p>El flujo se detuvo por un error. Mira el recorrido para ver en qué bloque.</p>
          <button type="button" className="ui-btn ui-btn--ghost" onClick={onStart}>Probar de nuevo</button>
        </div>
      ) : null}
      <div ref={end} />
    </div>
  );
}
