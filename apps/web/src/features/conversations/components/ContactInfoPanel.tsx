import type { ConversationStatus, ConversationSummary } from "@contracts/ConversationContracts";
import type { CreateLabelRequest, LabelSummary } from "@contracts/ContactContracts";
import { formatPhone } from "@shared/phone/formatPhone";
import { Avatar } from "./Avatar";
import { BoltGlyph, BotGlyph, CloseGlyph } from "./ChatGlyphs";
import { displayName } from "./displayName";
import { DeleteChatSection } from "./DeleteChatSection";
import { LabelsSection } from "./info/LabelsSection";
import { NotesSection } from "./info/NotesSection";

// ---------------------------------------------------------------------------
// «Info. del contacto» (como al tocar el nombre en WhatsApp iOS): quién es,
// por qué número escribe, quién lo atiende y el flujo en curso, ejecutar un
// flujo, sus etiquetas (`LabelsSection`), las notas internas del equipo
// (`NotesSection`) y, para dueños y administradores, eliminar el chat.
// ---------------------------------------------------------------------------

/** Quién atiende, según la atención del chat (en atención: el nombre del responsable). */
const ATTENDS: Partial<Record<ConversationStatus, string>> = { bot: "El bot", waiting: "Nadie aún (en espera)", resolved: "Resuelto (el bot, si vuelve a escribir)" };

const DATE = new Intl.DateTimeFormat("es", { day: "numeric", month: "long", year: "numeric" });

export function ContactInfoPanel({
  conversation,
  labels,
  labelsStatus,
  onClose,
  onToggleBot,
  onRunFlow,
  onSetLabels,
  onCreateLabel,
  onDelete
}: {
  readonly conversation: ConversationSummary;
  readonly labels: ReadonlyArray<LabelSummary>;
  readonly labelsStatus: "loading" | "ready" | "error";
  readonly onClose: () => void;
  readonly onToggleBot: () => void;
  readonly onRunFlow: () => void;
  readonly onSetLabels: (labelIds: ReadonlyArray<string>) => Promise<void>;
  readonly onCreateLabel: (request: CreateLabelRequest) => Promise<LabelSummary>;
  /** Eliminar el chat (solo si quien mira puede). */
  readonly onDelete?: () => Promise<void>;
}) {
  const name = displayName(conversation);
  const phone = formatPhone(conversation.phone).text;
  const attending = conversation.connectionDeleted ? "Nadie (número eliminado)" : ATTENDS[conversation.status] ?? conversation.assigneeName ?? "Un asesor";

  return (
    <aside className="ios-info" aria-label={`Info. de ${name}`}>
      <header className="ios-info__header">
        <button type="button" className="ios-icon-btn" aria-label="Cerrar info. del contacto" onClick={onClose}>
          <CloseGlyph />
        </button>
        <h2>Info. del contacto</h2>
      </header>

      <div className="ios-info__scroll">
        <div className="ios-info__hero">
          <Avatar name={conversation.contactName} phone={conversation.phone} photoUrl={conversation.contactAvatarUrl} size={84} />
          <strong>{name}</strong>
          <span>{conversation.contactName ? phone : "Sin nombre guardado"}</span>
        </div>

        {conversation.connectionDeleted ? null : (
          <div className="ios-info__actions">
            <button type="button" className="ios-action" onClick={onRunFlow}>
              <BoltGlyph />
              Ejecutar flujo
            </button>
            <button type="button" className={`ios-action${conversation.botEnabled ? " is-on" : ""}`} aria-pressed={conversation.botEnabled} onClick={onToggleBot}>
              <BotGlyph />
              {conversation.botEnabled ? "Bot activo" : "Bot pausado"}
            </button>
          </div>
        )}

        <section className="ios-group" aria-label="Atención">
          <div className="ios-group__row">
            <span>Atiende</span>
            <strong>{attending}</strong>
          </div>
          <div className="ios-group__row">
            <span>Flujo en curso</span>
            <strong>{conversation.activeFlowName ?? "Ninguno"}</strong>
          </div>
        </section>

        <LabelsSection conversation={conversation} labels={labels} labelsStatus={labelsStatus} onSetLabels={onSetLabels} onCreateLabel={onCreateLabel} />

        {conversation.contactId ? <NotesSection contactId={conversation.contactId} /> : null}

        <section className="ios-group" aria-label="Detalles">
          <div className="ios-group__row">
            <span>Teléfono</span>
            <strong>{phone}</strong>
          </div>
          <div className="ios-group__row">
            <span>Escribe a</span>
            <strong>{conversation.connectionName ? `${conversation.connectionName}${conversation.connectionDeleted ? " (eliminado)" : ""}` : "—"}</strong>
          </div>
          <div className="ios-group__row">
            <span>Chat desde</span>
            <strong>{DATE.format(new Date(conversation.createdAt))}</strong>
          </div>
        </section>

        {onDelete ? <DeleteChatSection name={name} onDelete={onDelete} /> : null}
      </div>
    </aside>
  );
}
