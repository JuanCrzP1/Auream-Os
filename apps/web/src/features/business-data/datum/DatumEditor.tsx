import { useId, useMemo, useState } from "react";
import {
  BUSINESS_DATA_LIMITS as LIMITS,
  BUSINESS_DATA_TYPES,
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
import { PreviewMoments, momentsOf } from "./PreviewMoments";
import { ValueInput } from "./ValueInput";

/** Como se edita: un número con sus puntos («1.200»); lo demás, tal cual se guardó (la fecha y el sí o no ya los entiende el control). */
export const editable = (datum: Pick<BusinessDatumSummary, "type" | "value">) => (datum.type === "number" ? businessValueText(datum) : datum.value);

/**
 * La pestaña «Dato»: «Así lo ve tu cliente» (se actualiza mientras escribes,
 * y con cambios programados se ve cada momento), el valor de siempre, el
 * nombre, el tipo y para qué es; dónde se usa y, para quien puede, guardar o
 * borrar. La clave no cambia: los mensajes la usan.
 */
export function DatumEditor({
  datum,
  all,
  timeZone,
  now,
  canManage,
  onSave,
  onDelete,
  onBusy,
  onDone
}: {
  readonly datum: BusinessDatumSummary;
  readonly all: ReadonlyArray<BusinessDatumSummary>;
  readonly timeZone: string;
  readonly now: Date;
  readonly canManage: boolean;
  readonly onSave: (changes: Partial<SaveBusinessDatumRequest>) => Promise<unknown>;
  readonly onDelete: () => void;
  readonly onBusy: (busy: boolean) => void;
  /** Guardado: se cierra el detalle, como en Campos del cliente. */
  readonly onDone: () => void;
}) {
  const valueId = useId();
  const [label, setLabel] = useState(datum.label);
  const [type, setType] = useState<BusinessDataType>(datum.type);
  const [value, setValue] = useState(editable(datum));
  const [description, setDescription] = useState(datum.description);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dirty = label.trim() !== datum.label || type !== datum.type || value !== editable(datum) || description.trim() !== datum.description;
  const uses = usesSummary(datum.uses);
  const scheduled = datum.schedules.length > 0;

  // Los momentos que se pueden ver: el de siempre (lo que se está escribiendo) y cada cambio programado.
  const moments = useMemo(() => momentsOf(datum.schedules, timeZone, now), [datum.schedules, timeZone, now]);
  const [moment, setMoment] = useState(() => moments.find((item) => item.active)?.id ?? "usual");
  const shownMoment = moments.find((item) => item.id === moment);
  const values = useMemo(() => {
    const draft = coerceFieldValue({ type, options: [] }, shownMoment?.value ?? value);
    return { ...businessValuesOf(all, now), [datum.key]: draft ?? shownMoment?.value ?? value };
  }, [all, now, datum.key, type, value, shownMoment]);

  const save = async () => {
    setBusy(true);
    onBusy(true);
    setError(null);
    try {
      await onSave({ label: label.trim(), type, value, description: description.trim() });
      onBusy(false);
      onDone();
    } catch (e) {
      setError(apiErrorMessage(e, "No se pudo guardar el dato."));
      setBusy(false);
      onBusy(false);
    }
  };

  return (
    <>
      <div className="bd-drawer__body">
        <section className="bd-drawer__section" aria-label="Así lo ve tu cliente">
          <h3>Así lo ve tu cliente</h3>
          {moments.length > 1 ? <PreviewMoments moments={moments} selected={moment} onSelect={setMoment} /> : null}
          <CustomerPreview datumKey={datum.key} example={datum.example} values={values} />
        </section>

        {canManage ? (
          <section className="bd-drawer__section" aria-label="Cambiar el dato">
            <div className="ui-field">
              <span id={valueId}>{scheduled ? "Valor de siempre" : "Valor"}</span>
              <ValueInput labelId={valueId} type={type} value={value} onChange={(next) => (setValue(next), setMoment("usual"))} />
              {datum.uses.length > 0 && value !== editable(datum) ? <span className="bd-drawer__warn">Al guardar, cambia en {uses.text}.</span> : null}
            </div>
            <label className="ui-field">
              <span>Nombre</span>
              <input className="ui-input" value={label} maxLength={LIMITS.maxLabel} onChange={(e) => setLabel(e.target.value)} />
            </label>
            <div className="ui-field">
              <span>Tipo</span>
              <TypePicker value={type} types={BUSINESS_DATA_TYPES} onChange={setType} />
              {scheduled && type !== datum.type ? <span className="bd-drawer__warn">Con cambios programados no se cambia el tipo: quítalos primero.</span> : null}
            </div>
            <label className="ui-field">
              <span>Para qué es</span>
              <input className="ui-input" value={description} maxLength={LIMITS.maxDescription} placeholder="Opcional" onChange={(e) => setDescription(e.target.value)} />
            </label>
          </section>
        ) : (
          <section className="bd-drawer__section">
            <h3>{scheduled ? "Valor de siempre" : "Valor"}</h3>
            <p className="bd-drawer__value">{businessValueText(datum)}</p>
            {datum.description ? <p className="ui-muted">{datum.description}</p> : null}
          </section>
        )}

        <section className="bd-drawer__section" aria-label="Dónde se usa">
          <h3>Dónde se usa · {uses.text}</h3>
          <DatumUses uses={datum.uses} empty={`Escribe {${datum.key}} en un mensaje de un flujo, una difusión o una respuesta rápida, o úsalo en el Condicional como «Dato del negocio».`} />
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
    </>
  );
}
