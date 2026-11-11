import { Fragment, forwardRef, type ReactNode, type UIEvent } from "react";
import type { ConversationMessage } from "@contracts/ConversationContracts";
import { dayKey, dayLabel } from "./chatTime";
import { MessageBubble } from "./MessageBubble";
import { canAct, threadView } from "./threadView";

/**
 * El hilo sobre el fondo de WhatsApp: «Ver mensajes anteriores», separadores
 * de día, colita en el último de cada tanda y las reacciones del equipo
 * sobre su mensaje.
 */
export const ChatThread = forwardRef<
  HTMLDivElement,
  {
    readonly messages: ReadonlyArray<ConversationMessage>;
    readonly hasMore: boolean;
    /** El chat se puede responder (su número sigue conectado). */
    readonly interactive: boolean;
    readonly footer?: ReactNode;
    readonly onScroll: (event: UIEvent<HTMLDivElement>) => void;
    readonly onLoadOlder: () => void;
    readonly onReply: (message: ConversationMessage) => void;
    readonly onReact: (message: ConversationMessage, emoji: string) => void;
  }
>(function ChatThread({ messages: all, hasMore, interactive, footer, onScroll, onLoadOlder, onReply, onReact }, ref) {
  const { messages, reactions } = threadView(all);
  return (
    <div className="ios-thread" ref={ref} onScroll={onScroll}>
      {hasMore ? (
        <button type="button" className="ios-older" onClick={onLoadOlder}>
          Ver mensajes anteriores
        </button>
      ) : null}
      {messages.map((message, index) => {
        const previous = messages[index - 1];
        const next = messages[index + 1];
        const newDay = !previous || dayKey(previous.createdAt) !== dayKey(message.createdAt);
        // Colita en el último de una tanda: el siguiente es del otro lado o de otro día.
        const tail = !next || next.direction !== message.direction || dayKey(next.createdAt) !== dayKey(message.createdAt);
        const actionable = interactive && canAct(message);
        const reaction = reactions.get(message.id);
        return (
          <Fragment key={message.id}>
            {newDay ? <p className="ios-day"><span>{dayLabel(message.createdAt)}</span></p> : null}
            <MessageBubble
              message={message}
              tail={tail}
              {...(reaction ? { reaction } : {})}
              {...(actionable ? { onReply: () => onReply(message), onReact: (emoji: string) => onReact(message, emoji) } : {})}
            />
          </Fragment>
        );
      })}
      {footer}
    </div>
  );
});
