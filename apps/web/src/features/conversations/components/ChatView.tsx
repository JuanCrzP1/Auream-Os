import { Fragment, useEffect, useLayoutEffect, useRef, useState } from "react";
import { MAX_AGENT_MESSAGE_LENGTH } from "@contracts/ConversationContracts";
import { useConversationThread } from "@shared/conversations/useConversationThread";
import { apiErrorMessage } from "@shared/http/apiErrorMessage";
import { formatPhone } from "@shared/phone/formatPhone";
import { Avatar } from "./Avatar";
import { BackGlyph, BoltGlyph, BotGlyph, SendGlyph } from "./ChatGlyphs";
import { dayKey, dayLabel } from "./chatTime";
import { displayName } from "./ConversationList";
import { MessageBubble } from "./MessageBubble";
import { SendFlowDialog } from "./SendFlowDialog";

// ---------------------------------------------------------------------------
// Un chat abierto, al estilo WhatsApp iOS: cabecera translúcida (contacto,
// número, flujo en curso, bot activo/pausado, enviar flujo), hilo sobre el
// fondo de WhatsApp con separadores de día, y la barra para responder.
// ---------------------------------------------------------------------------

export function ChatView({ conversationId, onBack }: { readonly conversationId: string; readonly onBack: () => void }) {
  const thread = useConversationThread(conversationId);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<{ readonly kind: "error" | "info"; readonly text: string } | null>(null);
  const [flowDialog, setFlowDialog] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const lastId = thread.messages.at(-1)?.id;

  // Baja al último mensaje si el usuario ya estaba abajo (no lo arrastra si lee lo anterior).
  useLayoutEffect(() => {
    const element = scroller.current;
    if (element && stick.current) element.scrollTop = element.scrollHeight;
  }, [lastId, thread.status]);

  useEffect(() => {
    setDraft("");
    setNotice(null);
    stick.current = true;
  }, [conversationId]);

  const conversation = thread.conversation;
  if (thread.status === "error" && !conversation) {
    return (
      <section className="ios-chat ios-chat--empty">
        <p className="ui-error" role="alert">No se pudo abrir el chat.</p>
      </section>
    );
  }
  if (!conversation) {
    return <section className="ios-chat ios-chat--empty" aria-busy="true"><span className="ios-spinner" aria-label="Cargando chat" /></section>;
  }

  const name = displayName(conversation);
  const send = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setNotice(null);
    stick.current = true;
    try {
      await thread.send(text);
      setDraft("");
    } catch (e) {
      setNotice({ kind: "error", text: apiErrorMessage(e, "No se pudo enviar el mensaje.") });
    } finally {
      setSending(false);
    }
  };

  const toggleBot = async () => {
    setNotice(null);
    try {
      await thread.setBot(!conversation.botEnabled);
    } catch (e) {
      setNotice({ kind: "error", text: apiErrorMessage(e, "No se pudo cambiar el bot.") });
    }
  };

  return (
    <section className="ios-chat" aria-label={`Chat con ${name}`}>
      <header className="ios-chat__header">
        <button type="button" className="ios-icon-btn ios-chat__back" aria-label="Volver a los chats" onClick={onBack}>
          <BackGlyph />
        </button>
        <Avatar name={conversation.contactName} phone={conversation.phone} size={38} />
        <div className="ios-chat__who">
          <strong>{name}</strong>
          <span>
            {conversation.contactName ? `${formatPhone(conversation.phone).text} · ` : ""}
            {conversation.activeFlowName ? `en «${conversation.activeFlowName}»` : conversation.connectionName}
          </span>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={conversation.botEnabled}
          className={`ios-bot-toggle${conversation.botEnabled ? " is-on" : ""}`}
          title={conversation.botEnabled ? "El bot responde este chat. Tócalo para atenderlo tú." : "Un asesor atiende este chat. Tócalo para que el bot vuelva a responder."}
          onClick={() => void toggleBot()}
        >
          <BotGlyph />
          <span>{conversation.botEnabled ? "Bot activo" : "Bot pausado"}</span>
        </button>
        <button type="button" className="ios-icon-btn ios-chat__flow" aria-label="Enviar un flujo" title="Enviar un flujo" onClick={() => setFlowDialog(true)}>
          <BoltGlyph />
        </button>
      </header>

      <div
        className="ios-thread"
        ref={scroller}
        onScroll={(event) => {
          const element = event.currentTarget;
          stick.current = element.scrollHeight - element.scrollTop - element.clientHeight < 80;
        }}
      >
        {thread.hasMore ? (
          <button type="button" className="ios-older" onClick={() => { stick.current = false; void thread.loadOlder(); }}>
            Ver mensajes anteriores
          </button>
        ) : null}
        {thread.messages.map((message, index) => {
          const previous = thread.messages[index - 1];
          const newDay = !previous || dayKey(previous.createdAt) !== dayKey(message.createdAt);
          return (
            <Fragment key={message.id}>
              {newDay ? <p className="ios-day"><span>{dayLabel(message.createdAt)}</span></p> : null}
              <MessageBubble message={message} />
            </Fragment>
          );
        })}
        {!conversation.botEnabled ? (
          <p className="ios-system">Atiendes este chat: el bot no responderá hasta que lo actives.</p>
        ) : null}
      </div>

      {notice ? <p className={`ios-notice ios-notice--${notice.kind}`} role={notice.kind === "error" ? "alert" : "status"}>{notice.text}</p> : null}

      <footer className="ios-composer">
        <textarea
          className="ios-composer__input"
          value={draft}
          rows={1}
          maxLength={MAX_AGENT_MESSAGE_LENGTH}
          placeholder="Mensaje"
          aria-label="Escribe un mensaje"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void send();
            }
          }}
        />
        <button type="button" className="ios-send" aria-label="Enviar" disabled={!draft.trim() || sending} onClick={() => void send()}>
          <SendGlyph />
        </button>
      </footer>

      {flowDialog ? (
        <SendFlowDialog
          contactName={name}
          onClose={() => setFlowDialog(false)}
          onSend={async (automationId) => {
            const result = await thread.launchFlow(automationId);
            stick.current = true;
            setNotice({ kind: "info", text: result.failed ? `Se envió «${result.flowName}», pero ${result.failed} mensaje(s) no salieron.` : `Se envió «${result.flowName}».` });
            return result;
          }}
        />
      ) : null}
    </section>
  );
}
