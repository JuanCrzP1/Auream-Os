import "./datum-drawer.css";
import { useId, useMemo, useState } from "react";
import {
  BUSINESS_DATA_LIMITS as LIMITS,
  BUSINESS_DATA_TYPES,
  BUSINESS_DATA_TYPE_LABEL,
  businessValueText,
  businessValuesOf,
  type BusinessDataType,
  type BusinessDatumSummary,
  type SaveBusinessDatumRequest
} from "@contracts/BusinessDataContracts";
import { coerceFieldValue } from "@contracts/FieldValues";
import { apiErrorMessage } from "@shared/http/apiErrorMessage";
import { TypePicker } from "@shared/contact-fields/TypePicker";
import { usesSummary } from "../businessDataText";
import { CustomerPreview } from "./CustomerPreview";
import { DatumUses } from "./DatumUses";
import { ValueInput } from "./ValueInput";

/** Como se edita: un número con sus puntos («1.200»); lo demás, tal cual se guardó (la fecha y el sí o no ya los entiende el control). */
const editable = (datum: Pick<BusinessDatumSummary, "type" | "value">) => (datum.type === "number" ? businessValueText(datum) : datum.value);

/**
 * El detalle de un dato: su valor y «Así lo ve tu cliente» (se actualiza
 * mientras escribes), dónde se usa y, para quien puede, cambiarlo o borrarlo.
 * La clave no cambia: los mensajes la usan.
 */
export function DatumDrawer({
  datum,
  all,
  canManage,
  onSave,
  onDelete,
  onClose
}: {
  readonly datum: BusinessDatumSummary;
  /** Todos los datos de la cuenta: un mensaje puede usar varios. */
  readonly all: ReadonlyArray<BusinessDatumSummary>;
  readonly canManage: boolean;
  readonly onSave: (changes: Partial<SaveBusinessDatumRequest>) => Promise<unknown>;
  readonly onDelete: () => void;
  readonly onClose: () => void;
}) {
  const titleId = useId();
  const valueId = useId();
  const [label, setLabel] = useState(datum.label);
  const [type, setType] = useState<BusinessDataType>(datum.type);
  const [value, setValue] = useState(editable(datum));
  const [description, setDescription] = useState(datum.description);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dirty = label.trim() !== datum.label || type !== datum.type || value !== editable(datum) || description.trim() !== datum.description;
  const uses = usesSummary(datum.uses);

  // La vista previa con lo que se está escribiendo, aunque aún no se guarde.
  const values = useMemo(() => {
    const draft = coerceFieldValue({ type, options: [] }, value);
    return { ...businessValuesOf(all), [datum.key]: draft ?? value };
  }, [all, datum.key, type, value]);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await onSave({ label: label.trim(), type, value, description: description.trim() });
      onClose();
    } catch (e) {
      setError(apiErrorMessage(e, "No se pudo guardar el dato."));
      setBusy(false);
    }
  };

  return (
    <div className="bd-drawer-overlay" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={busy ? undefined : onClose}>
      <aside className="bd-drawer" onClick={(e) => e.stopPropagation()}>
        <header className="bd-drawer__hero">
          <button type="button" className="bd-drawer__close" aria-label="Cerrar" onClick={onClose}>×</button>
          <span className="bd-drawer__eyebrow">Dato del negocio · {BUSINESS_DATA_TYPE_LABEL[datum.type]}</span>
          <h2 id={titleId}>{datum.label}</h2>
          <code className="bd-drawer__key">{`{${datum.key}}`}</code>
        </header>

        <div className="bd-drawer__body">
          <section className="bd-drawer__section" aria-label="Así lo ve tu cliente">
            <h3>Así lo ve tu cliente</h3>
            <CustomerPreview datumKey={datum.key} example={datum.example} values={values} />
          </section>

          {canManage ? (
            <section className="bd-drawer__section" aria-label="Cambiar el dato">
              <div className="ui-field">
                <span id={valueId}>Valor</span>
                <ValueInput labelId={valueId} type={type} value={value} onChange={setValue} />
                {datum.uses.length > 0 && value !== editable(datum) ? <span className="bd-drawer__warn">Al guardar, cambia en {uses.text}.</span> : null}
              </div>
              <label className="ui-field">
                <span>Nombre</span>
                <input className="ui-input" value={label} maxLength={LIMITS.maxLabel} onChange={(e) => setLabel(e.target.value)} />
              </label>
              <div className="ui-field">
                <span>Tipo</span>
                <TypePicker value={type} types={BUSINESS_DATA_TYPES} onChange={setType} />
              </div>
              <label className="ui-field">
                <span>Para qué es</span>
                <input className="ui-input" value={description} maxLength={LIMITS.maxDescription} placeholder="Opcional" onChange={(e) => setDescription(e.target.value)} />
              </label>
            </section>
          ) : (
            <section className="bd-drawer__section">
              <h3>Valor</h3>
              <p className="bd-drawer__value">{businessValueText(datum)}</p>
              {datum.description ? <p className="ui-muted">{datum.description}</p> : null}
            </section>
          )}

          <section className="bd-drawer__section" aria-label="Dónde se usa">
            <h3>Dónde se usa · {uses.text}</h3>
            <DatumUses uses={datum.uses} empty={`Escribe {${datum.key}} en un mensaje de un flujo, una difusión o una respuesta rápida, o úsalo en el Condicional como «Variable global».`} />
          </section>
          {error ? <p className="ui-error" role="alert">{error}</p> : null}
        </div>

        {canManage ? (
          <footer className="bd-drawer__footer">
            <button type="button" className="bd-drawer__delete" onClick={onDelete} disabled={busy}>Borrar dato</button>
            <button type="button" className="ui-btn ui-btn--primary" disabled={!dirty || busy || !value.trim() || !label.trim()} onClick={() => void save()}>
              {busy ? "Guardando…" : "Guardar cambios"}
            </button>
          </footer>
        ) : null}
      </aside>
    </div>
  );
}
