import "./contact-fields-section.css";
import { useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { fieldValueText } from "@contracts/FieldValues";
import { NewFieldDialog } from "@shared/contact-fields/NewFieldDialog";
import type { ContactFieldCatalog } from "@shared/contact-fields/useContactFieldCatalog";
import { FieldValueInput, type FieldDraft } from "./FieldValueInput";
import { originText } from "./fieldOrigin";
import { useContactFieldValues } from "./useContactFieldValues";

/** `resposta-lead` → «Resposta lead» (nombre propuesto al convertir un dato en campo). */
const labelFromKey = (key: string) => {
  const words = key.replace(/[._-]+/g, " ").trim();
  return (words.charAt(0).toUpperCase() + words.slice(1)).slice(0, 40);
};

/**
 * «Campos del cliente» en la ficha: cada campo en la forma de su tipo, con de
 * dónde salió; aparte, los datos sueltos que guardó un flujo (con «Convertir
 * en campo» para dueños y administradores). Lo que se cambia queda en
 * `changes` y lo guarda el botón Guardar de la ficha (solo lo que cambió).
 */
export function ContactFieldsSection({
  contactId,
  catalog,
  changes,
  onChange
}: {
  readonly contactId: string;
  readonly catalog: ContactFieldCatalog;
  readonly changes: Readonly<Record<string, FieldDraft>>;
  readonly onChange: (key: string, value: FieldDraft) => void;
}) {
  const { state, reload } = useContactFieldValues(contactId);
  const [converting, setConverting] = useState<string | null>(null);
  const canManage = catalog.data?.canManage ?? false;

  if (state.status === "loading" || (catalog.status === "loading" && !catalog.data)) return <p className="ui-muted">Cargando sus datos…</p>;
  if (state.status === "error") {
    return (
      <p className="ui-muted">
        No pudimos cargar sus datos. <button type="button" className="ui-link" onClick={() => void reload()}>Reintentar</button>
      </p>
    );
  }

  const { values, origins, canEdit } = state.data;
  const defined = new Set(catalog.fields.map((field) => field.key));
  const loose = Object.entries(values).filter(([key]) => !defined.has(key));

  return (
    <section className="cfv" aria-label="Campos del cliente">
      <div className="cfv__head">
        <span>Campos del cliente</span>
        {canManage ? <Link to="/settings/data?tab=customer">Organizar campos</Link> : null}
      </div>
      {catalog.fields.length === 0 ? <p className="ui-muted">Aún no hay campos del cliente. {canManage ? "Créalos en Configuración › Campos y datos › Campos del cliente." : "Los crean los dueños y administradores."}</p> : null}
      {catalog.fields.map((field) => {
        const origin = origins[field.key];
        return (
          <div key={field.key} className="cfv__field">
            <span className="cfv__label">{field.label}</span>
            <FieldValueInput field={field} value={field.key in changes ? changes[field.key]! : (values[field.key] ?? null)} disabled={!canEdit} onChange={(value) => onChange(field.key, value)} />
            {origin && !(field.key in changes) ? <span className="cfv__origin">{originText(origin)}</span> : null}
          </div>
        );
      })}

      {loose.length > 0 ? (
        <div className="cfv__loose" aria-label="Otros datos que guardó un flujo" role="group">
          <strong>Otros datos que guardó un flujo</strong>
          {loose.map(([key, value]) => (
            <div key={key} className="cfv__loose-row">
              <code>{key}</code>
              <span>{fieldValueText(value)}</span>
              {canManage ? <button type="button" className="ui-link" onClick={() => setConverting(key)}>Convertir en campo</button> : null}
            </div>
          ))}
        </div>
      ) : null}

      {converting
        ? createPortal(
            <NewFieldDialog
              fixedKey={converting}
              initialLabel={labelFromKey(converting)}
              onClose={() => setConverting(null)}
              onCreate={async (request) => {
                await catalog.create(request);
                await reload();
              }}
            />,
            document.body
          )
        : null}
    </section>
  );
}
