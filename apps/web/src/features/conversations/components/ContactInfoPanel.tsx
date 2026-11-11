import { useState } from "react";
import type { ConversationSummary } from "@contracts/ConversationContracts";
import type { CreateLabelRequest, LabelSummary } from "@contracts/ContactContracts";
import { apiErrorMessage } from "@shared/http/apiErrorMessage";
import { formatPhone } from "@shared/phone/formatPhone";
import { Avatar } from "./Avatar";
import { BoltGlyph, BotGlyph, CheckGlyph, CloseGlyph, TagGlyph } from "./ChatGlyphs";
import { ChatLabel } from "./ChatLabels";
import { displayName } from "./ConversationList";
import { DeleteChatSection } from "./DeleteChatSection";

// ---------------------------------------------------------------------------
// «Info. del contacto» (como al tocar el nombre en WhatsApp iOS): quién es,
// por qué número escribe, si lo atiende el bot o un asesor, el flujo en
// curso, ejecutar un flujo y sus etiquetas (las de Contactos, las mismas que
// ponen los flujos), con opción de crear una nueva.
// ---------------------------------------------------------------------------

/** Colores para etiquetas nuevas creadas desde el chat (se pueden cambiar en Contactos). */
const NEW_LABEL_COLORS = ["#16a34a", "#2563eb", "#f59e0b", "#db2777", "#7c3aed", "#0891b2", "#dc2626", "#64748b"];

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
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const name = displayName(conversation);
  const phone = formatPhone(conversation.phone).text;
  const current = conversation.labels.map((label) => label.id);

  const save = async (labelIds: ReadonlyArray<string>, busyKey: string) => {
    setSaving(busyKey);
    setError(null);
    try {
      await onSetLabels(labelIds);
    } catch (e) {
      setError(apiErrorMessage(e, "No se pudieron guardar las etiquetas."));
    } finally {
      setSaving(null);
    }
  };

  const toggle = (id: string) => void save(current.includes(id) ? current.filter((labelId) => labelId !== id) : [...current, id], id);

  const create = async () => {
    const trimmed = newName.trim();
    if (!trimmed || saving) return;
    const existing = labels.find((label) => label.name.toLowerCase() === trimmed.toLowerCase());
    if (existing) {
      setNewName("");
      if (!current.includes(existing.id)) await save([...current, existing.id], existing.id);
      return;
    }
    setSaving("new");
    setError(null);
    try {
      const created = await onCreateLabel({ name: trimmed, color: NEW_LABEL_COLORS[labels.length % NEW_LABEL_COLORS.length]! });
      setNewName("");
      await onSetLabels([...current, created.id]);
    } catch (e) {
      setError(apiErrorMessage(e, "No se pudo crear la etiqueta."));
    } finally {
      setSaving(null);
    }
  };

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
            <strong>{conversation.connectionDeleted ? "Nadie (número eliminado)" : conversation.botEnabled ? "El bot" : "Un asesor"}</strong>
          </div>
          <div className="ios-group__row">
            <span>Flujo en curso</span>
            <strong>{conversation.activeFlowName ?? "Ninguno"}</strong>
          </div>
        </section>

        <section className="ios-group" aria-labelledby="ios-info-labels">
          <div className="ios-group__title">
            <h3 id="ios-info-labels">
              <TagGlyph />
              Etiquetas
            </h3>
            {conversation.contactId ? (
              <button type="button" className="ios-link-btn" aria-expanded={editing} onClick={() => setEditing((open) => !open)}>
                {editing ? "Listo" : "Editar"}
              </button>
            ) : null}
          </div>
          {!conversation.contactId ? (
            <p className="ios-group__hint">Este chat aún no tiene un contacto asociado para etiquetar.</p>
          ) : conversation.labels.length ? (
            <div className="ios-group__labels">
              {conversation.labels.map((label) => (
                <ChatLabel key={label.id} label={label} />
              ))}
            </div>
          ) : (
            <p className="ios-group__hint">Sin etiquetas.</p>
          )}

          {editing && conversation.contactId ? (
            <div className="ios-label-picker">
              {labelsStatus === "loading" ? <p className="ios-group__hint">Cargando etiquetas…</p> : null}
              {labelsStatus === "error" ? <p className="ios-group__hint">No se pudieron cargar las etiquetas.</p> : null}
              <ul aria-label="Etiquetas de la cuenta">
                {labels.map((label) => {
                  const on = current.includes(label.id);
                  return (
                    <li key={label.id}>
                      <button
                        type="button"
                        className="ios-label-picker__option"
                        role="checkbox"
                        aria-checked={on}
                        disabled={saving !== null}
                        style={{ ["--label-color" as string]: label.color }}
                        onClick={() => toggle(label.id)}
                      >
                        <span className="ios-label__dot" aria-hidden="true" />
                        <span className="ios-label-picker__name">{label.name}</span>
                        {saving === label.id ? <span className="ios-label-picker__state">Guardando…</span> : on ? <CheckGlyph /> : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
              <form
                className="ios-label-picker__new"
                onSubmit={(event) => {
                  event.preventDefault();
                  void create();
                }}
              >
                <input
                  value={newName}
                  maxLength={40}
                  placeholder="Nueva etiqueta"
                  aria-label="Nombre de la nueva etiqueta"
                  onChange={(event) => setNewName(event.target.value)}
                />
                <button type="submit" className="ios-link-btn" disabled={!newName.trim() || saving !== null}>
                  {saving === "new" ? "Creando…" : "Crear"}
                </button>
              </form>
            </div>
          ) : null}
          {error ? <p className="ios-group__hint ios-group__hint--error" role="alert">{error}</p> : null}
        </section>

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
