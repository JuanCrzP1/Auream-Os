import { useState } from "react";
import type { ContactSummary, LabelSummary } from "@contracts/ContactContracts";
import { saveContactFieldValues } from "@shared/contact-fields/contactFieldsApi";
import type { ContactFieldCatalog } from "@shared/contact-fields/useContactFieldCatalog";
import { apiErrorMessage } from "@shared/http/apiErrorMessage";
import { setContactLabels, updateContact } from "../services/contactsApi";
import { ContactFieldsSection } from "./fields/ContactFieldsSection";
import type { FieldDraft } from "./fields/FieldValueInput";
import { LabelChip } from "./LabelChip";

interface ContactDrawerProps {
  readonly contact: ContactSummary;
  readonly catalog: ReadonlyArray<LabelSummary>;
  /** Los Campos del cliente de la cuenta (uno solo para toda la página). */
  readonly fields: ContactFieldCatalog;
  readonly onSaved: (contact: ContactSummary) => void;
  readonly onClose: () => void;
}

/** Ficha de un contacto: datos, etiquetas del catálogo y sus Campos del cliente. */
export function ContactDrawer({ contact, catalog, fields, onSaved, onClose }: ContactDrawerProps) {
  const [name, setName] = useState(contact.name ?? "");
  const [email, setEmail] = useState(contact.email ?? "");
  const [labelIds, setLabelIds] = useState(() => new Set(contact.labels.map((label) => label.id)));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Solo lo que cambió en sus campos: así no se pisa lo que un flujo guarde mientras está abierta.
  const [fieldChanges, setFieldChanges] = useState<Readonly<Record<string, FieldDraft>>>({});

  const toggle = (id: string) =>
    setLabelIds((current) => {
      const next = new Set(current);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const save = async () => {
    setSaving(true);
    try {
      // Primero sus campos: son lo único que puede no pasar la validación (un número, una fecha).
      if (Object.keys(fieldChanges).length > 0) await saveContactFieldValues(contact.id, { changes: fieldChanges });
      await updateContact(contact.id, { name: name.trim() || null, email: email.trim() || null });
      onSaved(await setContactLabels(contact.id, [...labelIds]));
      onClose();
    } catch (e) {
      setError(apiErrorMessage(e, "No se pudo guardar el contacto."));
    } finally {
      setSaving(false);
    }
  };

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

        <ContactFieldsSection
          contactId={contact.id}
          catalog={fields}
          changes={fieldChanges}
          onChange={(key, value) => setFieldChanges((current) => ({ ...current, [key]: value }))}
        />

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
