import type { ConversationSummary } from "@contracts/ConversationContracts";
import { formatPhone } from "@shared/phone/formatPhone";
import { Avatar } from "./Avatar";
import { BackGlyph, BoltGlyph, BotGlyph, InfoGlyph } from "./ChatGlyphs";

/**
 * La cabecera del chat: volver, el contacto (tocarlo abre su info), número o
 * flujo en curso, «Ejecutar flujo», el bot activo/pausado y la info.
 */
export function ChatHeader({
  conversation,
  name,
  infoOpen,
  onBack,
  onInfo,
  onRunFlow,
  onToggleBot
}: {
  readonly conversation: ConversationSummary;
  readonly name: string;
  readonly infoOpen: boolean;
  readonly onBack: () => void;
  readonly onInfo: (open: boolean) => void;
  readonly onRunFlow: () => void;
  readonly onToggleBot: () => void;
}) {
  return (
    <header className="ios-chat__header">
      <button type="button" className="ios-icon-btn ios-chat__back" aria-label="Volver a los chats" onClick={onBack}>
        <BackGlyph />
      </button>
      <button type="button" className="ios-chat__who" aria-label={`Ver info. de ${name}`} onClick={() => onInfo(!infoOpen)}>
        <Avatar name={conversation.contactName} phone={conversation.phone} photoUrl={conversation.contactAvatarUrl} size={38} />
        <span className="ios-chat__who-text">
          <strong>{name}</strong>
          <span>
            {conversation.connectionDeleted
              ? `Número eliminado · ${conversation.connectionName}`
              : conversation.activeFlowName
                ? `En el flujo «${conversation.activeFlowName}»`
                : `${conversation.contactName ? `${formatPhone(conversation.phone).text} · ` : ""}${conversation.connectionName}`}
          </span>
        </span>
      </button>
      {conversation.connectionDeleted ? null : (
        <>
          <button type="button" className="ios-run-flow" onClick={onRunFlow}>
            <BoltGlyph />
            <span>Ejecutar flujo</span>
          </button>
          <button
            type="button"
            role="switch"
            aria-checked={conversation.botEnabled}
            aria-label={conversation.botEnabled ? "Bot activo" : "Bot pausado"}
            className={`ios-bot-toggle${conversation.botEnabled ? " is-on" : ""}`}
            title={conversation.botEnabled ? "El bot responde este chat. Tócalo para atenderlo tú." : "Un asesor atiende este chat. Tócalo para que el bot vuelva a responder."}
            onClick={onToggleBot}
          >
            <BotGlyph />
            <span>{conversation.botEnabled ? "Bot activo" : "Bot pausado"}</span>
            <span className="ios-bot-toggle__track" aria-hidden="true">
              <span className="ios-bot-toggle__thumb" />
            </span>
          </button>
        </>
      )}
      <button type="button" className={`ios-icon-btn${infoOpen ? " is-active" : ""}`} aria-label="Info. del contacto" aria-pressed={infoOpen} onClick={() => onInfo(!infoOpen)}>
        <InfoGlyph />
      </button>
    </header>
  );
}
