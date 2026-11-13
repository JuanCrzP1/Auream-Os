import "./field-drawer.css";
import { useId, useState } from "react";
import { CONTACT_FIELD_LIMITS as LIMITS, CONTACT_FIELD_TYPE_LABEL, type ContactFieldSummary, type ContactFieldType, type SaveContactFieldRequest } from "@contracts/ContactFieldContracts";
import { apiErrorMessage } from "@shared/http/apiErrorMessage";
import { clients, count, filledPercent } from "../fieldText";
import { TypeChip } from "../list/TypeChip";
import { FieldUses } from "./FieldUses";
import { OptionsEditor } from "./OptionsEditor";
import { TypePicker } from "./TypePicker";

const same = (a: ReadonlyArray<string>, b: ReadonlyArray<string>) => a.length === b.length && a.every((value, index) => value === b[index]);

/**
 * El detalle de un campo: nombre, tipo y opciones (la clave no cambia: los
 * flujos la usan), de dónde sale, quién lo usa y en cuántos clientes está.
 */
export function FieldDrawer({
  field,
  total,
  canManage,
  onSave,
  onDelete,
  onClose
}: {
  readonly field: ContactFieldSummary;
  readonly total: number;
  readonly canManage: boolean;
  readonly onSave: (changes: Partial<SaveContactFieldRequest>) => Promise<unknown>;
  readonly onDelete: () => void;
  readonly onClose: () => void;
}) {
  const titleId = useId();
  const [label, setLabel] = useState(field.label);
  const [type, setType] = useState<ContactFieldType>(field.type);
  const [options, setOptions] = useState<string[]>([...field.options]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const fills = field.uses.filter((use) => use.role === "fills");
  const reads = field.uses.filter((use) => use.role === "reads");
  const percent = filledPercent(field.filled, total);
  const dirty = label.trim() !== field.label || type !== field.type || (type === "list" && !same(options, field.options));
  const valid = label.trim().length > 0 && (type !== "list" || options.length >= LIMITS.minOptions);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await onSave({ label: label.trim(), type, ...(type === "list" ? { options } : {}) });
      onClose();
    } catch (e) {
      setError(apiErrorMessage(e, "No se pudo guardar el campo."));
      setBusy(false);
    }
  };

  const copy = () => {
    void navigator.clipboard?.writeText(`{${field.key}}`).then(() => setCopied(true), () => undefined);
  };

  return (
    <div className="cf-drawer-overlay" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={busy ? undefined : onClose}>
      <aside className="cf-drawer" onClick={(e) => e.stopPropagation()}>
        <header className="cf-drawer__hero">
          <button type="button" className="cf-drawer__close" aria-label="Cerrar" onClick={onClose}>×</button>
          <span className="cf-drawer__eyebrow">Campo del cliente</span>
          <h2 id={titleId}>{field.label}</h2>
          <span className="cf-drawer__tags">
            <TypeChip type={field.type} options={field.options} />
            <button type="button" className="cf-drawer__key" onClick={copy} title="Copiar para usarlo en un mensaje">
              <code>{`{${field.key}}`}</code>
              <span>{copied ? "Copiado" : "Copiar"}</span>
            </button>
          </span>
        </header>

        <div className="cf-drawer__body">
          {canManage ? (
            <section className="cf-drawer__section" aria-label="Datos del campo">
              <label className="ui-field">
                <span>Nombre</span>
                <input className="ui-input" value={label} maxLength={LIMITS.maxLabel} onChange={(e) => setLabel(e.target.value)} />
              </label>
              <div className="ui-field">
                <span>Tipo</span>
                <TypePicker value={type} onChange={setType} />
                {type !== field.type && field.filled > 0 ? (
                  <span className="cf-drawer__warn">Los {count(field.filled)} datos que ya existen se quedan como están; lo nuevo se guarda como {CONTACT_FIELD_TYPE_LABEL[type].toLowerCase()}.</span>
                ) : null}
              </div>
              {type === "list" ? (
                <div className="ui-field">
                  <span>Opciones</span>
                  <OptionsEditor options={options} onChange={setOptions} />
                </div>
              ) : null}
            </section>
          ) : field.type === "list" ? (
            <section className="cf-drawer__section" aria-label="Opciones">
              <h3>Opciones</h3>
              <OptionsEditor options={field.options} onChange={() => undefined} disabled />
            </section>
          ) : null}

          <section className="cf-drawer__section" aria-label="De dónde sale">
            <h3>De dónde sale</h3>
            <FieldUses uses={fills} empty="Ningún flujo lo llena. Elígelo en Esperar respuesta, Menú o Integración, o llénalo en la ficha del cliente." />
          </section>
          <section className="cf-drawer__section" aria-label="Lo usan">
            <h3>Lo usan</h3>
            <FieldUses uses={reads} empty="Ningún mensaje ni condición lo usa todavía." />
          </section>
          <section className="cf-drawer__section" aria-label="Lleno en">
            <h3>Lleno en</h3>
            <p className="cf-drawer__fill">
              <span className="cf-bar" aria-hidden="true"><span style={{ width: `${percent}%` }} /></span>
              {count(field.filled)} de {clients(total)} ({percent} %)
            </p>
          </section>
          {error ? <p className="ui-error" role="alert">{error}</p> : null}
        </div>

        {canManage ? (
          <footer className="cf-drawer__footer">
            <button type="button" className="cf-drawer__delete" onClick={onDelete} disabled={busy}>Borrar campo</button>
            <button type="button" className="ui-btn ui-btn--primary" disabled={!dirty || !valid || busy} onClick={() => void save()}>{busy ? "Guardando…" : "Guardar"}</button>
          </footer>
        ) : null}
      </aside>
    </div>
  );
}
