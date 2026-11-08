import type { LabelSummary } from "@contracts/ContactContracts";

/** Etiqueta con su color. Opcionalmente, con botón para quitarla. */
export function LabelChip({ label, onRemove }: { readonly label: Pick<LabelSummary, "name" | "color">; readonly onRemove?: () => void }) {
  return (
    <span className="contacts-chip" style={{ "--chip-color": label.color } as React.CSSProperties}>
      <span className="contacts-chip__dot" aria-hidden="true" />
      {label.name}
      {onRemove ? (
        <button type="button" className="contacts-chip__remove" aria-label={`Quitar ${label.name}`} onClick={onRemove}>
          ×
        </button>
      ) : null}
    </span>
  );
}
