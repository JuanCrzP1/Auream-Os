import type { LabelDuplicate, LabelOverview } from "@contracts/LabelManagementContracts";

const clients = (n: number) => `${n.toLocaleString("es-CO")} ${n === 1 ? "cliente" : "clientes"}`;

/**
 * Las repetidas: etiquetas que se leen igual pero el sistema cuenta aparte
 * (mayúsculas, tildes o un carácter invisible, como las trae WhatsApp). Parten
 * los conteos, los embudos y las condiciones. Se propone unirlas en una.
 */
export function DuplicatesCard({
  duplicates,
  labels,
  canManage,
  onMerge
}: {
  readonly duplicates: ReadonlyArray<LabelDuplicate>;
  readonly labels: ReadonlyArray<LabelOverview>;
  readonly canManage: boolean;
  readonly onMerge: (duplicate: LabelDuplicate) => void;
}) {
  if (duplicates.length === 0) return null;
  const find = (id: string) => labels.find((label) => label.id === id);
  return (
    <section className="lb-duplicates" aria-label="Etiquetas repetidas">
      {duplicates.map((duplicate) => {
        const group = [duplicate.keepId, ...duplicate.otherIds].map(find).filter((label): label is LabelOverview => label !== undefined);
        return (
          <div key={duplicate.keepId} className="lb-duplicates__item">
            <span className="lb-duplicates__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24"><rect x="8" y="8" width="13" height="13" rx="2" /><path d="M4 16V5a1 1 0 0 1 1-1h11" /></svg>
            </span>
            <span className="lb-duplicates__text">
              <strong>«{duplicate.name}» está {group.length === 2 ? "dos veces" : `${group.length} veces`}</strong>
              <span>
                Se ven igual, pero el sistema las cuenta aparte (mayúsculas, tildes o un carácter invisible, como las trae WhatsApp). Tus conteos y condiciones se parten:{" "}
                {group.map((label) => clients(label.contactCount ?? 0)).join(" + ")}.
              </span>
            </span>
            {canManage ? (
              <button type="button" className="lb-duplicates__action" onClick={() => onMerge(duplicate)}>
                Unir en «{duplicate.name}»
              </button>
            ) : null}
          </div>
        );
      })}
    </section>
  );
}
