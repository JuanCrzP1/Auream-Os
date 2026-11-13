import { useState } from "react";
import type { ContactSummary, LabelSummary } from "@contracts/ContactContracts";
import { fieldValueText } from "@contracts/FieldValues";
import { apiErrorMessage } from "@shared/http/apiErrorMessage";
import { setContactLabels, updateContact } from "../services/contactsApi";
import { LabelChip } from "./LabelChip";

interface ContactDrawerProps {
  readonly contact: ContactSummary;
  readonly catalog: ReadonlyArray<LabelSummary>;
  readonly onSaved: (contact: ContactSummary) => void;
  readonly onClose: () => void;
}

/** Ficha de un contacto: datos, etiquetas del catálogo y campos guardados por los flujos. */
export function ContactDrawer({ contact, catalog, onSaved, onClose }: ContactDrawerProps) {
  const [name, setName] = useState(contact.name ?? "");
  const [email, setEmail] = useState(contact.email ?? "");
  const [labelIds, setLabelIds] = useState(() => new Set(contact.labels.map((label) => label.id)));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const toggle = (id: string) =>
    setLabelIds((current) => {
      const next = new Set(current);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const save = async () => {
    setSaving(true);
    try {
      await updateContact(contact.id, { name: name.trim() || null, email: email.trim() || null });
      onSaved(await setContactLabels(contact.id, [...labelIds]));
      onClose();
    } catch (e) {
      setError(apiErrorMessage(e, "No se pudo guardar el contacto."));
    } finally {
      setSaving(false);
    }
  };

  const fields = Object.entries(contact.customFields);

  return (
    <div className="contacts-drawer-overlay" role="dialog" aria-modal="true" aria-labelledby="contact-drawer-title" onClick={onClose}>
      <aside className="contacts-drawer" onClick={(e) => e.stopPropagation()}>
        <header className="contacts-drawer__header">
          <h2 id="contact-drawer-title">{contact.name || contact.phone || "Contacto"}</h2>
          <button type="button" className="ui-btn ui-btn--ghost" aria-label="Cerrar" onClick={onClose}>×</button>
        </header>

        <label className="ui-field">
          <span>Nombre</span>
          <input className="ui-input" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="ui-field">
          <span>Teléfono</span>
          <input className="ui-input" value={contact.phone ?? ""} disabled />
        </label>
        <label className="ui-field">
          <span>Correo</span>
          <input className="ui-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>

        <div className="ui-field">
          <span>Etiquetas</span>
          {catalog.length === 0 ? (
            <p className="ui-muted">Crea etiquetas en la pestaña «Etiquetas».</p>
          ) : (
            <div className="contacts-label-picker">
              {catalog.map((label) => (
                <button
                  key={label.id}
                  type="button"
                  aria-pressed={labelIds.has(label.id)}
                  className={`contacts-label-toggle${labelIds.has(label.id) ? " contacts-label-toggle--on" : ""}`}
                  onClick={() => toggle(label.id)}
                >
                  <LabelChip label={label} />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="ui-field">
          <span>Campos guardados por los flujos</span>
          {fields.length === 0 ? (
            <p className="ui-muted">Ninguno todavía.</p>
          ) : (
            <dl className="contacts-fields">
              {fields.map(([key, value]) => (
                <div key={key}>
                  <dt>{key}</dt>
                  <dd>{fieldValueText(value)}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>

        {error ? <p className="ui-error" role="alert">{error}</p> : null}
        <footer className="contacts-drawer__footer">
          <button type="button" className="ui-btn ui-btn--ghost" onClick={onClose}>Cancelar</button>
          <button type="button" className="ui-btn ui-btn--primary" onClick={() => void save()} disabled={saving}>
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </footer>
      </aside>
    </div>
  );
}
