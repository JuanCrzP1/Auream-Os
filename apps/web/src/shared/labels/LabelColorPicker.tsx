import "./label-colors.css";
import { LABEL_COLORS } from "@contracts/ContactContracts";

const NAMES: Readonly<Record<string, string>> = {
  "#64748b": "Gris", "#ef4444": "Rojo", "#f97316": "Naranja", "#f59e0b": "Ámbar", "#84cc16": "Lima", "#10b981": "Verde",
  "#06b6d4": "Cian", "#3b82f6": "Azul", "#6366f1": "Índigo", "#8b5cf6": "Violeta", "#d946ef": "Fucsia", "#ec4899": "Rosado"
};

/** El color de una etiqueta, entre la paleta de la cuenta (un grupo de radios con el nombre de cada color). */
export function LabelColorPicker({ value, onChange }: { readonly value: string; readonly onChange: (color: string) => void }) {
  return (
    <div className="label-colors" role="radiogroup" aria-label="Color">
      {LABEL_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          role="radio"
          aria-checked={value.toLowerCase() === color}
          aria-label={NAMES[color] ?? color}
          className={`label-colors__swatch${value.toLowerCase() === color ? " is-on" : ""}`}
          style={{ background: color }}
          onClick={() => onChange(color)}
        />
      ))}
    </div>
  );
}
