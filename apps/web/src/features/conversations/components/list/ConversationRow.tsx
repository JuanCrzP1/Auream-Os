import type { ConversationSummary } from "@contracts/ConversationContracts";
import { Avatar } from "../Avatar";
import { listTime } from "../chatTime";
import { ChatLabels } from "../ChatLabels";
import { displayName } from "../displayName";
import { waitingFor } from "./waitTime";

const AUTHOR_PREFIX = { contact: "", bot: "🤖 ", agent: "Tú: " } as const;

/**
 * Un chat en la lista: avatar, nombre, hora, último mensaje y no leídos; abajo,
 * su atención (en espera, quién lo atiende, resuelto), cuánto lleva el
 * cliente esperando (en rojo si pasa de 15 min), sus etiquetas y el número.
 */
export function ConversationRow({
  conversation,
  selected,
  meId,
  showConnection,
  onSelect
}: {
  readonly conversation: ConversationSummary;
  readonly selected: boolean;
  readonly meId: string | null;
  readonly showConnection: boolean;
  readonly onSelect: () => void;
}) {
  const name = displayName(conversation);
  const prefix = conversation.lastMessageAuthor ? AUTHOR_PREFIX[conversation.lastMessageAuthor] : "";
  const wait = waitingFor(conversation);
  const assignee = conversation.assigneeId === meId && meId ? "Tú" : conversation.assigneeName;
  const attention =
    conversation.status === "waiting" ? { tone: "waiting", text: "En espera" }
    : conversation.status === "attending" ? { tone: "attending", text: assignee ?? "En atención" }
    : conversation.status === "resolved" ? { tone: "resolved", text: "Resuelto" }
    : null;
  const extra = attention || wait || conversation.labels.length || showConnection || conversation.connectionDeleted;

  return (
    <button
      type="button"
      className={`ios-row${selected ? " is-selected" : ""}`}
      aria-current={selected ? "true" : undefined}
      aria-label={`${name}${conversation.unreadCount ? `, ${conversation.unreadCount} sin leer` : ""}${wait ? `, espera hace ${wait.text}` : ""}`}
      onClick={onSelect}
    >
      <Avatar name={conversation.contactName} phone={conversation.phone} photoUrl={conversation.contactAvatarUrl} size={40} />
      <span className="ios-row__body">
        <span className="ios-row__top">
          <span className="ios-row__name">{name}</span>
          <span className={`ios-row__time${conversation.unreadCount ? " is-unread" : ""}`}>{listTime(conversation.lastMessageAt)}</span>
        </span>
        <span className="ios-row__bottom">
          <span className="ios-row__preview">
            {prefix}
            {conversation.lastMessageText || "Sin mensajes"}
          </span>
          {conversation.unreadCount ? <span className="ios-badge">{conversation.unreadCount}</span> : null}
        </span>
        {extra ? (
          <span className="ios-row__extra">
            {attention ? <span className={`row-attention row-attention--${attention.tone}`}>{attention.text}</span> : null}
            {wait ? <span className={`row-wait${wait.urgent ? " is-urgent" : ""}`} title="Lo que lleva el cliente esperando respuesta">⏱ {wait.text}</span> : null}
            <ChatLabels labels={conversation.labels} />
            {conversation.connectionDeleted ? (
              <span className="ios-row__connection is-deleted">{conversation.connectionName} · eliminado</span>
            ) : showConnection ? (
              <span className="ios-row__connection">{conversation.connectionName}</span>
            ) : null}
          </span>
        ) : null}
      </span>
    </button>
  );
}
