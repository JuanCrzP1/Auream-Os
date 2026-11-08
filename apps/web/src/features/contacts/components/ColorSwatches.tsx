import { LABEL_COLORS } from "@contracts/ContactContracts";

/** Selector de color de etiqueta entre la paleta ofrecida. */
export function ColorSwatches({ value, onChange }: { readonly value: string; readonly onChange: (color: string) => void }) {
  return (
    <div className="contacts-swatches" role="radiogroup" aria-label="Color">
      {LABEL_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          role="radio"
          aria-checked={value === color}
          aria-label={`Color ${color}`}
          className={`contacts-swatch${value === color ? " contacts-swatch--active" : ""}`}
          style={{ background: color }}
          onClick={() => onChange(color)}
        />
      ))}
    </div>
  );
}
