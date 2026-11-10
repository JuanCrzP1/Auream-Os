import "./lab-chat.css";
import { useEffect, useRef } from "react";
import { FlowBubble, TesterBubble } from "./LabBubble";
import { LabWaitChip } from "./LabWaitChip";
import { turnInput, type LabTurn } from "./labModel";
import { useMessagePlayback } from "./useMessagePlayback";

const PRESENCE_LABEL = { composing: "escribiendo…", recording: "grabando audio…" } as const;

/**
 * La prueba como un chat de WhatsApp: el probador escribe como el cliente (a
 * la derecha) y el flujo responde (a la izquierda) con sus pausas reales,
 * «escribiendo…», audios que se escuchan, imágenes y botones. Al final, dónde
 * quedó: esperando respuesta, en una espera (que sigue sola si es corta),
 * terminado o con error.
 */
export function LabChat({
  turns,
  busy,
  blockName,
  onFocusBlock,
  onChoose,
  onContinue,
  onStart
}: {
  readonly turns: ReadonlyArray<LabTurn>;
  readonly busy: boolean;
  readonly blockName: (nodeId: string) => string;
  readonly onFocusBlock: (nodeId: string) => void;
  readonly onChoose: (optionId: string, title: string) => void;
  /** Seguir con la espera pendiente (`auto`: terminó sola). */
  readonly onContinue: (auto: boolean) => void;
  readonly onStart: () => void;
}) {
  const last = turns[turns.length - 1] ?? null;
  const playback = useMessagePlayback(last?.id ?? null, last?.response.messages ?? []);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView?.({ block: "end", behavior: "smooth" });
  }, [turns.length, playback.visible, busy]);

  if (!last) {
    return (
      <div className="lab-chat">
        <div className="lab-chat__wall lab-chat__wall--empty">
          <p className="lab-system">Las pruebas no se envían por WhatsApp ni tocan a tus contactos reales.</p>
          <p className="lab-chat__intro">Escribe como si fueras el cliente y mira cómo responde tu flujo.</p>
          <button type="button" className="ui-btn ui-btn--primary" onClick={onStart} disabled={busy}>
            {busy ? "Iniciando…" : "Iniciar prueba"}
          </button>
        </div>
      </div>
    );
  }

  const { status, wait, state } = last.response;
  const settled = playback.done && !busy;
  const waitingNode = status === "waiting_reply" ? state.session?.currentNodeId : null;
  const typing = busy ? "composing" : playback.presence;

  return (
    <div className="lab-chat">
      <div className="lab-chat__wall" aria-live="polite">
        {turns.map((turn) => {
          const input = turnInput(turn.event);
          const isLast = turn === last;
          const shown = isLast ? turn.response.messages.slice(0, playback.visible) : turn.response.messages;
          return (
            <div key={turn.id} className="lab-chat__turn">
              {input !== null ? <TesterBubble text={input} at={turn.at} /> : null}
              {turn.event.type === "skip-wait" && !turn.auto ? <p className="lab-system">Se adelantó la espera</p> : null}
              {turn.response.notice ? <p className="lab-system">{turn.response.notice}</p> : null}
              {shown.map((message, index) =>
                message.kind === "pause" ? null : (
                  <FlowBubble
                    key={`${turn.id}-${index}`}
                    message={message}
                    at={turn.at}
                    blockName={blockName(message.nodeId)}
                    onFocusBlock={() => onFocusBlock(message.nodeId)}
                    {...(isLast && settled && message.kind === "menu" && message.nodeId === waitingNode ? { onChoose } : {})}
                  />
                )
              )}
            </div>
          );
        })}

        {typing ? (
          <div className="lab-typing" role="status">
            <span className="lab-typing__dots" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            {PRESENCE_LABEL[typing]}
          </div>
        ) : null}

        {settled && wait ? <LabWaitChip key={`${wait.nodeId}:${wait.revision}`} wait={wait} clockOffsetMs={last.clockOffsetMs} blockName={blockName(wait.nodeId)} onContinue={onContinue} /> : null}
        {settled && waitingNode && !wait ? <p className="lab-system">Esperando tu respuesta en «{blockName(waitingNode)}»</p> : null}
        {settled && status === "finished" ? (
          <div className="lab-system lab-system--end">
            Fin del flujo: llegó al final de su camino.
            <button type="button" className="lab-system__action" onClick={onStart}>Probar de nuevo</button>
          </div>
        ) : null}
        {settled && status === "failed" ? (
          <div className="lab-system lab-system--failed" role="alert">
            El flujo se detuvo por un error. Mira el recorrido para ver en qué bloque.
            <button type="button" className="lab-system__action" onClick={onStart}>Probar de nuevo</button>
          </div>
        ) : null}
        <div ref={end} />
      </div>
    </div>
  );
}
