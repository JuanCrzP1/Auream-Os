import "./contact-fields.css";
import type { ContactFieldType } from "@contracts/ContactFieldContracts";
import { TYPE_CHOICES } from "./fieldTypes";

const ICON: Readonly<Record<ContactFieldType, string>> = {
  text: "M5 6h14M5 12h14M5 18h9",
  number: "M9 4 7 20M17 4l-2 16M4 9h16M3 15h16",
  date: "M4 6h16v14H4zM4 10h16M9 3v4M15 3v4",
  boolean: "M4 12a8 8 0 1 0 16 0 8 8 0 1 0-16 0M8.5 12l2.5 2.5L16 9.5",
  list: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"
};

/** Los tipos como tarjetas (un grupo de radios): ícono lila y nombre. `types`: solo esos (Datos del negocio no tiene lista). */
export function TypePicker<T extends ContactFieldType = ContactFieldType>({
  value,
  onChange,
  disabled = false,
  types
}: {
  readonly value: T;
  readonly onChange: (type: T) => void;
  readonly disabled?: boolean;
  readonly types?: ReadonlyArray<T>;
}) {
  const choices = types ? TYPE_CHOICES.filter((choice) => (types as ReadonlyArray<ContactFieldType>).includes(choice.type)) : TYPE_CHOICES;
  return (
    <div className="cf-types" role="radiogroup" aria-label="Tipo" style={types ? { gridTemplateColumns: `repeat(${choices.length}, minmax(0, 1fr))` } : undefined}>
      {choices.map((choice) => (
        <button
          key={choice.type}
          type="button"
          role="radio"
          aria-checked={value === choice.type}
          className={`cf-types__item${value === choice.type ? " is-on" : ""}`}
          disabled={disabled}
          onClick={() => onChange(choice.type as T)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d={ICON[choice.type]} /></svg>
          {choice.label}
        </button>
      ))}
    </div>
  );
}
