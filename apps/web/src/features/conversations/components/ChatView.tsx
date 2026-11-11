import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ConversationMessage } from "@contracts/ConversationContracts";
import type { CreateLabelRequest, LabelSummary } from "@contracts/ContactContracts";
import { useConversationThread } from "@shared/conversations/useConversationThread";
import { apiErrorMessage } from "@shared/http/apiErrorMessage";
import type { useQuickReplies } from "@shared/quick-replies/useQuickReplies";
import { ChatHeader } from "./ChatHeader";
import { ChatThread } from "./ChatThread";
import { Composer } from "./composer/Composer";
import { ContactInfoPanel } from "./ContactInfoPanel";
import { displayName } from "./ConversationList";
import { SendFlowDialog } from "./SendFlowDialog";

// ---------------------------------------------------------------------------
// Un chat abierto, al estilo WhatsApp iOS: la cabecera (`ChatHeader`), el
// hilo (`ChatThread`) y la barra para responder (`Composer`: respuestas
// rápidas, archivos, emojis, notas de voz y citas). A la derecha, «Info. del
// contacto». Aquí solo se coordina: avisos, la cita en curso y los diálogos.
// ---------------------------------------------------------------------------

type Notice = { readonly kind: "error" | "info"; readonly text: string } | null;

export function ChatView({
  conversationId,
  labels,
  labelsStatus,
  quickReplies,
  canManage,
  infoOpen,
  onInfo,
  onBack,
  onDeleted,
  onCreateLabel
}: {
  readonly conversationId: string;
  readonly labels: ReadonlyArray<LabelSummary>;
  readonly labelsStatus: "loading" | "ready" | "error";
  readonly quickReplies: ReturnType<typeof useQuickReplies>;
  /** Quien mira puede eliminar el chat. */
  readonly canManage: boolean;
  readonly infoOpen: boolean;
  readonly onInfo: (open: boolean) => void;
  readonly onBack: () => void;
  readonly onDeleted: () => void;
  readonly onCreateLabel: (request: CreateLabelRequest) => Promise<LabelSummary>;
}) {
  const thread = useConversationThread(conversationId);
  const [notice, setNotice] = useState<Notice>(null);
  const [flowDialog, setFlowDialog] = useState(false);
  const [replyTo, setReplyTo] = useState<ConversationMessage | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const lastId = thread.messages.at(-1)?.id;

  // Baja al último mensaje si el usuario ya estaba abajo (no lo arrastra si lee lo anterior).
  useLayoutEffect(() => {
    const element = scroller.current;
    if (element && stick.current) element.scrollTop = element.scrollHeight;
  }, [lastId, thread.status]);

  useEffect(() => {
    setNotice(null);
    setReplyTo(null);
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
  const live = !conversation.connectionDeleted;

  const toggleBot = async () => {
    setNotice(null);
    try {
      await thread.setBot(!conversation.botEnabled);
    } catch (e) {
      setNotice({ kind: "error", text: apiErrorMessage(e, "No se pudo cambiar el bot.") });
    }
  };

  const react = async (message: ConversationMessage, emoji: string) => {
    setNotice(null);
    try {
      await thread.react(message.id, emoji);
    } catch (e) {
      setNotice({ kind: "error", text: apiErrorMessage(e, "No se pudo reaccionar al mensaje.") });
    }
  };

  return (
    <>
      <section className="ios-chat" aria-label={`Chat con ${name}`}>
        <ChatHeader
          conversation={conversation}
          name={name}
          infoOpen={infoOpen}
          onBack={onBack}
          onInfo={onInfo}
          onRunFlow={() => setFlowDialog(true)}
          onToggleBot={() => void toggleBot()}
        />

        <ChatThread
          ref={scroller}
          messages={thread.messages}
          hasMore={thread.hasMore}
          interactive={live}
          onScroll={(event) => {
            const element = event.currentTarget;
            stick.current = element.scrollHeight - element.scrollTop - element.clientHeight < 80;
          }}
          onLoadOlder={() => {
            stick.current = false;
            void thread.loadOlder();
          }}
          onReply={setReplyTo}
          onReact={(message, emoji) => void react(message, emoji)}
          footer={
            !conversation.botEnabled && live ? (
              <div className="ios-system ios-system--note">
                <span>Atiendes este chat: el bot no responderá hasta que lo actives.</span>
                <button type="button" className="ios-link-btn" onClick={() => void toggleBot()}>
                  Activar bot
                </button>
              </div>
            ) : null
          }
        />

        {notice ? <p className={`ios-notice ios-notice--${notice.kind}`} role={notice.kind === "error" ? "alert" : "status"}>{notice.text}</p> : null}

        {live ? (
          <Composer
            key={conversationId}
            contactName={conversation.contactName}
            quickReplies={quickReplies}
            replyTo={replyTo}
            onCancelReply={() => setReplyTo(null)}
            onSend={async (request) => {
              stick.current = true;
              await thread.send(request);
            }}
            onError={(text) => setNotice(text ? { kind: "error", text } : null)}
          />
        ) : (
          <footer className="ios-composer ios-composer--closed" role="note">
            El número «{conversation.connectionName}» fue eliminado. Puedes leer y etiquetar este chat, pero ya no responder desde él.
          </footer>
        )}

        {flowDialog ? (
          <SendFlowDialog
            contactName={name}
            onClose={() => setFlowDialog(false)}
            onSend={async (automationId) => {
              const result = await thread.launchFlow(automationId);
              stick.current = true;
              setNotice({ kind: "info", text: result.failed ? `Se ejecutó «${result.flowName}», pero ${result.failed} mensaje(s) no salieron.` : `Se ejecutó «${result.flowName}».` });
              return result;
            }}
          />
        ) : null}
      </section>
      {infoOpen ? (
        <ContactInfoPanel
          conversation={conversation}
          labels={labels}
          labelsStatus={labelsStatus}
          onClose={() => onInfo(false)}
          onToggleBot={() => void toggleBot()}
          onRunFlow={() => setFlowDialog(true)}
          onSetLabels={thread.setLabels}
          onCreateLabel={onCreateLabel}
          {...(canManage
            ? {
                onDelete: async () => {
                  await thread.remove();
                  onDeleted();
                }
              }
            : {})}
        />
      ) : null}
    </>
  );
}
