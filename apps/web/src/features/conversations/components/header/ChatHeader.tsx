import "./chat-header.css";
import type { ChatAgent, ConversationSummary } from "@contracts/ConversationContracts";
import { formatPhone } from "@shared/phone/formatPhone";
import { Avatar } from "../Avatar";
import { BackGlyph, BoltGlyph, InfoGlyph, SaleGlyph } from "../ChatGlyphs";
import { AttentionControls } from "./AttentionControls";
import { HeaderLabels } from "./HeaderLabels";

/**
 * La cabecera del chat: volver, el contacto (tocarlo abre su info) con su
 * número o flujo en curso y sus etiquetas; la atención (estado, «Tomar chat»
 * o «Resolver»), «Registrar venta» (si puede), «Ejecutar flujo» y la info.
 */
export function ChatHeader({
  conversation,
  name,
  infoOpen,
  agents,
  meId,
  canWrite,
  onBack,
  onInfo,
  onRunFlow,
  onRecordSale,
  onToggleBot,
  onTake,
  onAssign,
  onResolve
}: {
  readonly conversation: ConversationSummary;
  readonly name: string;
  readonly infoOpen: boolean;
  readonly agents: ReadonlyArray<ChatAgent>;
  readonly meId: string | null;
  /** Quien mira puede atender (no es de solo lectura). */
  readonly canWrite: boolean;
  readonly onBack: () => void;
  readonly onInfo: (open: boolean) => void;
  readonly onRunFlow: () => void;
  /** Registrar una venta de este chat (solo si quien mira puede anotar ventas). */
  readonly onRecordSale?: () => void;
  readonly onToggleBot: () => void;
  readonly onTake: () => void;
  readonly onAssign: (assigneeId: string | null) => void;
  readonly onResolve: () => void;
}) {
  const live = !conversation.connectionDeleted;
  return (
    <header className="ios-chat__header">
      <button type="button" className="ios-icon-btn ios-chat__back" aria-label="Volver a los chats" onClick={onBack}>
        <BackGlyph />
      </button>
      <div className="chat-who">
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
        <HeaderLabels labels={conversation.labels} onOpen={() => onInfo(true)} />
      </div>
      {live && canWrite ? (
        <>
          <AttentionControls
            conversation={conversation}
            agents={agents}
            meId={meId}
            onTake={onTake}
            onAssign={onAssign}
            onResolve={onResolve}
            onToggleBot={onToggleBot}
          />
          {onRecordSale ? (
            <button type="button" className="ios-icon-btn chat-run-flow" aria-label="Registrar venta" title="Registrar venta" onClick={onRecordSale}>
              <SaleGlyph />
            </button>
          ) : null}
          <button type="button" className="ios-icon-btn chat-run-flow" aria-label="Ejecutar flujo" title="Ejecutar flujo" onClick={onRunFlow}>
            <BoltGlyph />
          </button>
        </>
      ) : null}
      <button type="button" className={`ios-icon-btn${infoOpen ? " is-active" : ""}`} aria-label="Info. del contacto" aria-pressed={infoOpen} onClick={() => onInfo(!infoOpen)}>
        <InfoGlyph />
      </button>
    </header>
  );
}
