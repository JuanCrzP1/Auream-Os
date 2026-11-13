import { useId, useState } from "react";
import type { LabelOverview } from "@contracts/LabelManagementContracts";
import { apiErrorMessage } from "@shared/http/apiErrorMessage";
import { labelDisplayName, stageOf } from "../labelText";
import { LabelUses } from "./LabelUses";

const clients = (n: number) => `${n.toLocaleString("es-CO")} ${n === 1 ? "cliente" : "clientes"}`;

/**
 * Unir una etiqueta en otra, o borrarla. Antes dice qué hace: dónde trabaja
 * (la etapa, los flujos, las difusiones…) y a cuál pasan sus clientes y sus
 * usos, para que nada se rompa. Una que nadie usa se borra sin más (sus
 * clientes solo la pierden). Una etapa del CRM no se une en otra ni se borra
 * aquí: se cambia en el embudo.
 */
export function MoveLabelDialog({
  label,
  labels,
  mode,
  initialInto,
  onMove,
  onDelete,
  onClose
}: {
  readonly label: LabelOverview;
  readonly labels: ReadonlyArray<LabelOverview>;
  /** Unir (siempre pasa a otra) o borrar (pasa a otra solo si se usa). */
  readonly mode: "merge" | "delete";
  readonly initialInto?: string;
  readonly onMove: (into: string) => Promise<unknown>;
  readonly onDelete: () => Promise<unknown>;
  readonly onClose: () => void;
}) {
  const titleId = useId();
  const others = labels.filter((other) => other.id !== label.id);
  const [into, setInto] = useState(initialInto ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stage = stageOf(label.uses);
  const needsTarget = mode === "merge" || label.uses.length > 0;
  const target = others.find((other) => other.id === into);
  const count = label.contactCount ?? 0;

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await (needsTarget ? onMove(into) : onDelete());
      onClose();
    } catch (e) {
      setError(apiErrorMessage(e, mode === "merge" ? "No se pudo unir la etiqueta." : "No se pudo borrar la etiqueta."));
      setBusy(false);
    }
  };

  return (
    <div className="ui-overlay" role="alertdialog" aria-modal="true" aria-labelledby={titleId} onClick={busy ? undefined : onClose}>
      <div className="ui-dialog lb-dialog" onClick={(e) => e.stopPropagation()}>
        <div>
          <h2 id={titleId}>{mode === "merge" ? `Unir «${labelDisplayName(label.name)}» en otra` : label.uses.length > 0 ? `«${labelDisplayName(label.name)}» está trabajando` : `¿Borrar «${labelDisplayName(label.name)}»?`}</h2>
          <p className="ui-muted">
            {stage
              ? `Es la etapa del embudo «${stage.pipelineName}»: para quitarla, cámbiala en CRM › Embudos. Aquí puedes unir otra etiqueta EN esta.`
              : needsTarget
                ? `Sus ${clients(count)} y todo lo que la usa pasan a la que elijas. Después se borra.`
                : count > 0
                  ? `Nada la usa. Sus ${clients(count)} solo la pierden; no se puede deshacer.`
                  : "Nadie la tiene ni la usa."}
          </p>
        </div>
        {label.uses.length > 0 ? (
          <div className="lb-dialog__risk">
            <strong>Si la borras sin más, esto deja de funcionar:</strong>
            <LabelUses uses={label.uses} empty="" />
          </div>
        ) : null}
        {needsTarget && !stage ? (
          <label className="ui-field">
            <span>Pasar sus clientes y sus usos a</span>
            <select className="ui-input" value={into} onChange={(e) => setInto(e.target.value)}>
              <option value="">Elige una etiqueta</option>
              {others.map((other) => (
                <option key={other.id} value={other.id}>
                  {labelDisplayName(other.name)}{stageOf(other.uses) ? ` · etapa de «${stageOf(other.uses)!.pipelineName}»` : ""}
                </option>
              ))}
            </select>
            {target ? (
              <span className="lb-dialog__hint">
                {stageOf(target.uses) ? `Sus clientes entran a la etapa «${target.name}» del embudo, como si un flujo les pusiera la etiqueta. ` : ""}
                Los flujos, las difusiones y los webhooks pasan a usar «{target.name}» al instante; los clientes pasan en unos segundos.
              </span>
            ) : null}
          </label>
        ) : null}
        {error ? <p className="ui-error" role="alert">{error}</p> : null}
        <div className="ui-dialog__footer">
          <button type="button" className="ui-btn ui-btn--ghost" onClick={onClose} disabled={busy}>Cancelar</button>
          {stage ? null : (
            <button type="button" className="ui-btn ui-btn--danger" disabled={busy || (needsTarget && !target)} onClick={() => void confirm()}>
              {busy ? "Un momento…" : mode === "merge" ? "Unir" : needsTarget ? "Pasar y borrar" : "Borrar etiqueta"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
