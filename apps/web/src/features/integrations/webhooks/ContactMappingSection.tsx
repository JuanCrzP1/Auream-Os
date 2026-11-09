import type { WebhookMapping } from "@contracts/WebhookContracts";
import { CountryDialPicker } from "@shared/ui/country-dial/CountryDialPicker";
import { sameTarget, type PathTarget } from "./mappingTarget";

/**
 * Vincular al contacto: de qué dato del envío salen el teléfono (obligatorio
 * para actuar), el nombre, el correo y los campos personalizados. Cada campo
 * se escribe o se llena con clic en el árbol del envío (el que tiene el foco).
 */
export function ContactMappingSection({
  mapping,
  target,
  onTarget,
  onChange
}: {
  readonly mapping: WebhookMapping;
  readonly target: PathTarget | null;
  readonly onTarget: (target: PathTarget) => void;
  readonly onChange: (mapping: WebhookMapping) => void;
}) {
  const pathInput = (key: "phonePath" | "namePath" | "emailPath", label: string, placeholder: string) => (
    <label className="ui-field">
      <span>{label}</span>
      <input
        className={`ui-input webhook-path${sameTarget(target, key) ? " webhook-path--target" : ""}`}
        value={mapping[key]}
        placeholder={placeholder}
        onFocus={() => onTarget(key)}
        onChange={(event) => onChange({ ...mapping, [key]: event.target.value.trim() })}
      />
    </label>
  );
  const fields = mapping.fields;
  const setField = (index: number, change: Partial<WebhookMapping["fields"][number]>) =>
    onChange({ ...mapping, fields: fields.map((field, i) => (i === index ? { ...field, ...change } : field)) });

  return (
    <section className="webhook-card" aria-labelledby="webhook-contact-title">
      <header className="webhook-card__head">
        <div>
          <h2 id="webhook-contact-title">Vincular al contacto</h2>
          <p className="ui-muted">Elige un campo y haz clic en un dato del envío, o escribe su ruta (p. ej. <code>data.buyer.phone</code>).</p>
        </div>
      </header>
      <div className="webhook-grid">
        {pathInput("phonePath", "Teléfono (obligatorio)", "data.buyer.phone")}
        <div className="ui-field">
          <span>Prefijo si llega sin él</span>
          <CountryDialPicker value={mapping.defaultCountryCode} ariaLabel="Prefijo por defecto" onChange={(defaultCountryCode) => onChange({ ...mapping, defaultCountryCode })} />
        </div>
        {pathInput("namePath", "Nombre", "data.buyer.name")}
        {pathInput("emailPath", "Correo", "data.buyer.email")}
      </div>

      <div className="webhook-fields">
        <div className="webhook-fields__head">
          <h3>Campos personalizados</h3>
          <button type="button" className="ui-btn ui-btn--ghost" onClick={() => { onChange({ ...mapping, fields: [...fields, { key: "", path: "" }] }); onTarget({ field: fields.length }); }}>
            + Agregar campo
          </button>
        </div>
        {fields.length === 0 ? <p className="ui-muted">Sin campos extra. Guarda más datos del envío en la ficha del contacto (ciudad, producto, valor…).</p> : null}
        {fields.map((field, index) => (
          <div key={index} className="webhook-fields__row">
            <input className="ui-input" aria-label={`Nombre del campo ${index + 1}`} value={field.key} placeholder="ciudad" onChange={(event) => setField(index, { key: event.target.value.trim() })} />
            <input
              className={`ui-input webhook-path${sameTarget(target, { field: index }) ? " webhook-path--target" : ""}`}
              aria-label={`Dato del campo ${index + 1}`}
              value={field.path}
              placeholder="data.buyer.city"
              onFocus={() => onTarget({ field: index })}
              onChange={(event) => setField(index, { path: event.target.value.trim() })}
            />
            <button type="button" className="ai-card__icon-btn ai-card__icon-btn--danger" aria-label={`Quitar campo ${index + 1}`} onClick={() => onChange({ ...mapping, fields: fields.filter((_, i) => i !== index) })}>
              ×
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
