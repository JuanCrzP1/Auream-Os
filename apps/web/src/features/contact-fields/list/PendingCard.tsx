import type { FieldSuggestions } from "@contracts/ContactFieldToolsContracts";

const ICON = {
  list: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",
  merge: "M6 4v6a4 4 0 0 0 4 4h8M18 14l-3-3M18 14l-3 3M6 20v-4",
  tidy: "M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12zM12 11.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z"
} as const;

function Item({ icon, title, detail, action, onAction }: { icon: keyof typeof ICON; title: string; detail: string; action: string; onAction: () => void }) {
  return (
    <div className="cf-pending__item">
      <span className="cf-pending__icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d={ICON[icon]} /></svg></span>
      <div className="cf-pending__text">
        <strong>{title}</strong>
        <span>{detail}</span>
      </div>
      <button type="button" className="cf-soft-btn" onClick={onAction}>{action}</button>
    </div>
  );
}

const quoted = (values: ReadonlyArray<string>) => values.map((value) => `«${value}»`).join(", ");

/**
 * «Por ordenar»: datos que tus flujos ya guardan y aún no son campos, claves
 * que parecen el mismo dato y campos con valores escritos de varias formas.
 * Solo sugiere: nada cambia hasta que lo confirmes.
 */
export function PendingCard({
  pending,
  suggestions,
  onReview,
  onMerge,
  onTidy
}: {
  /** Datos sin convertir en campo. */
  readonly pending: number;
  readonly suggestions: FieldSuggestions | undefined;
  readonly onReview: () => void;
  readonly onMerge: (keys: ReadonlyArray<string>) => void;
  readonly onTidy: (fieldId: string) => void;
}) {
  const toMerge = suggestions?.toMerge ?? [];
  const toTidy = suggestions?.toTidy ?? [];
  const count = (pending > 0 ? 1 : 0) + toMerge.length + toTidy.length;
  if (count === 0) return null;

  return (
    <section className="cf-pending" aria-label="Para ordenar">
      <div className="cf-pending__head">
        <strong>{count === 1 ? "1 cosa por ordenar" : `${count} cosas por ordenar`}</strong>
        <span>Nada cambia hasta que lo confirmes</span>
      </div>
      {pending > 0 ? (
        <Item
          icon="list"
          title={pending === 1 ? "Tus flujos guardan 1 dato que aún no es un campo" : `Tus flujos guardan ${pending} datos que aún no son campos`}
          detail="Te proponemos el nombre y el tipo de cada uno; tú eliges cuáles convertir."
          action="Revisar"
          onAction={onReview}
        />
      ) : null}
      {toMerge.map((group) => (
        <Item
          key={group.keys.join("|")}
          icon="merge"
          title={`${group.keys.length} campos parecen guardar el mismo dato`}
          detail={`${group.keys.join(", ")}: únelos en uno y los bloques que los usan se actualizan solos.`}
          action="Revisar y unir"
          onAction={() => onMerge(group.keys)}
        />
      ))}
      {toTidy.map((entry) => (
        <Item
          key={entry.fieldId}
          icon="tidy"
          title={entry.kind === "asList" ? `«${entry.label}» está escrita de ${entry.count} formas` : `«${entry.label}» tiene ${entry.count} ${entry.count === 1 ? "valor" : "valores"} fuera de su lista`}
          detail={`${quoted(entry.examples)}… ${entry.kind === "asList" ? "Conviértela en lista: te proponemos cómo agruparlas y tú lo confirmas." : "Te proponemos a qué opción pasa cada uno."}`}
          action="Ordenar valores"
          onAction={() => onTidy(entry.fieldId)}
        />
      ))}
    </section>
  );
}
