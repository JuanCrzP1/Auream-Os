import { useState } from "react";
import type { ConversationSummary } from "@contracts/ConversationContracts";
import type { CreateLabelRequest, LabelSummary } from "@contracts/ContactContracts";
import { apiErrorMessage } from "@shared/http/apiErrorMessage";
import { CheckGlyph, TagGlyph } from "../ChatGlyphs";
import { ChatLabel } from "../ChatLabels";

/** Colores para etiquetas nuevas creadas desde el chat (se pueden cambiar en Contactos). */
const NEW_LABEL_COLORS = ["#16a34a", "#2563eb", "#f59e0b", "#db2777", "#7c3aed", "#0891b2", "#dc2626", "#64748b"];

/**
 * Las etiquetas del cliente en la info del chat (las de Contactos, las mismas
 * que ponen los flujos): verlas, ponerlas o quitarlas y crear una nueva.
 */
export function LabelsSection({
  conversation,
  labels,
  labelsStatus,
  onSetLabels,
  onCreateLabel
}: {
  readonly conversation: ConversationSummary;
  readonly labels: ReadonlyArray<LabelSummary>;
  readonly labelsStatus: "loading" | "ready" | "error";
  readonly onSetLabels: (labelIds: ReadonlyArray<string>) => Promise<void>;
  readonly onCreateLabel: (request: CreateLabelRequest) => Promise<LabelSummary>;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);
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
  );
}
