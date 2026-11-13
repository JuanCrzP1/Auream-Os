import { ScheduledBubbles } from "./scheduled/ScheduledBubbles";
import type { ScheduledMessages } from "./scheduled/useScheduledMessages";

/**
 * Lo que va al final del hilo: los mensajes programados que aún no salen y,
 * si un asesor atiende, el aviso de que el bot está en pausa.
 */
export function ChatThreadFooter({
  scheduled,
  canWrite,
  botPaused,
  onToggleBot,
  onSent,
  onError
}: {
  readonly scheduled: ScheduledMessages;
  readonly canWrite: boolean;
  /** El bot está en pausa en un chat que se puede responder. */
  readonly botPaused: boolean;
  readonly onToggleBot: () => void;
  /** Un programado salió ya («Enviar ahora»): traer el hilo. */
  readonly onSent: () => void;
  readonly onError: (text: string) => void;
}) {
  return (
    <>
      <ScheduledBubbles scheduled={scheduled} canWrite={canWrite} onSent={onSent} onError={onError} />
      {botPaused ? (
        <div className="ios-system ios-system--note">
          <span>Atiendes este chat: el bot no responderá hasta que lo actives.</span>
          <button type="button" className="ios-link-btn" onClick={onToggleBot}>
            Activar bot
          </button>
        </div>
      ) : null}
    </>
  );
}
