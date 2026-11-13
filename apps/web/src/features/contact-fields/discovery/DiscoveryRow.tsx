import { CONTACT_FIELD_LIMITS as LIMITS, CONTACT_FIELD_TYPE_LABEL, type ContactFieldType, type DiscoveredField } from "@contracts/ContactFieldContracts";
import { count, TYPE_CHOICES, usesSummary } from "../fieldText";

/** Lo que quien revisa decide de cada dato: si se convierte, con qué nombre y de qué tipo. */
export interface Choice {
  readonly on: boolean;
  readonly label: string;
  readonly type: ContactFieldType;
}

export const choiceFor = (field: DiscoveredField): Choice => ({ on: !field.technical, label: field.suggestedLabel, type: field.suggestedType });

/** Un dato que ya se guarda: su clave y quién lo llena, el nombre y el tipo propuestos, y en cuántos clientes está. */
export function DiscoveryRow({ field, choice, onChange }: { readonly field: DiscoveredField; readonly choice: Choice; readonly onChange: (choice: Choice) => void }) {
  const canList = field.suggestedOptions.length >= LIMITS.minOptions;
  const uses = usesSummary(field.uses);
  const spellings = field.suggestedType === "list" && field.distinctValues > field.suggestedOptions.length;
  return (
    <li className={`cf-found${choice.on ? " is-on" : ""}`}>
      <label className="cf-found__check">
        <input type="checkbox" checked={choice.on} aria-label={`Convertir ${field.key}`} onChange={(e) => onChange({ ...choice, on: e.target.checked })} />
      </label>
      <span className="cf-found__key">
        <code>{field.key}</code>
        <span>{field.uses.length > 0 ? uses.text : "Lo guardó una integración o tu equipo"}</span>
        {field.similarTo.length > 0 ? <span className="cf-found__similar">Parece el mismo dato que {field.similarTo.map((key) => `«${key}»`).join(", ")}</span> : null}
      </span>
      <input className="ui-input cf-found__label" value={choice.label} maxLength={LIMITS.maxLabel} aria-label={`Nombre para ${field.key}`} onChange={(e) => onChange({ ...choice, label: e.target.value })} />
      <select className="ui-input cf-found__type" value={choice.type} aria-label={`Tipo para ${field.key}`} onChange={(e) => onChange({ ...choice, type: e.target.value as ContactFieldType })}>
        {TYPE_CHOICES.map((option) => (
          <option key={option.type} value={option.type} disabled={option.type === "list" && !canList}>
            {option.type === "list" && canList ? `${CONTACT_FIELD_TYPE_LABEL.list} · ${field.suggestedOptions.length}` : option.label}
          </option>
        ))}
      </select>
      <span className="cf-found__filled">
        <strong>{count(field.filled)}</strong>
        {spellings ? <span>{field.distinctValues} formas de escribirlo</span> : null}
      </span>
    </li>
  );
}
