import "./import-clients.css";
import { useEffect, useId, useState } from "react";
import type { PipelineSummary } from "@contracts/CrmContracts";
import { apiErrorMessage } from "@shared/http/apiErrorMessage";
import { crmApi } from "../services/crmApi";

const PERIODS: ReadonlyArray<{ readonly days: number | null; readonly label: string }> = [
  { days: 7, label: "7 días" },
  { days: 30, label: "30 días" },
  { days: 90, label: "90 días" },
  { days: null, label: "Todos" }
];

/** Tandas seguidas como máximo en una vez (de 500 clientes cada una). */
const MAX_ROUNDS = 10;

/**
 * Traer al embudo a los clientes que ya tienes: los que escribieron en el
 * periodo elegido y aún no están en él entran a la etapa de entrada. Primero
 * dice cuántos son; nadie se mueve hasta tocar «Traer».
 */
export function ImportClientsDialog({ pipeline, justCreated, onDone, onClose }: {
  readonly pipeline: PipelineSummary;
  /** Se acaba de crear el embudo (el texto lo ofrece como siguiente paso). */
  readonly justCreated: boolean;
  readonly onDone: () => void;
  readonly onClose: () => void;
}) {
  const titleId = useId();
  const [days, setDays] = useState<number | null>(30);
  const [count, setCount] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const entry = pipeline.stages.find((stage) => stage.id === pipeline.entryStageId);

  useEffect(() => {
    let alive = true;
    setCount(null);
    setError(null);
    crmApi
      .importPreview(pipeline.id, days)
      .then((response) => alive && setCount(response.count))
      .catch((e) => alive && setError(apiErrorMessage(e, "No se pudo contar a tus clientes.")));
    return () => {
      alive = false;
    };
  }, [pipeline.id, days]);

  const bring = async () => {
    setBusy(true);
    setError(null);
    try {
      for (let round = 0; round < MAX_ROUNDS; round += 1) {
        const result = await crmApi.importClients(pipeline.id, days);
        if (!result.remaining || result.count === 0) break;
      }
      onDone();
      onClose();
    } catch (e) {
      setError(apiErrorMessage(e, "No se pudieron traer los clientes."));
      setBusy(false);
    }
  };

  const plural = count === 1 ? "cliente" : "clientes";
  return (
    <div className="ui-overlay" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={busy ? undefined : onClose}>
      <div className="ui-dialog crm-dialog import-clients" onClick={(event) => event.stopPropagation()}>
        <h2 id={titleId}>{justCreated ? "¿Traer a los clientes que ya tienes?" : "Traer clientes existentes"}</h2>
        <p className="ui-muted">
          Los que te escribieron y aún no están en «{pipeline.name}» entran a <strong>{entry?.name ?? "la etapa de entrada"}</strong>. Desde ahora, los que escriban entran solos.
        </p>
        <div className="import-clients__periods" role="radiogroup" aria-label="Escribieron en los últimos">
          <span>Escribieron en los últimos</span>
          {PERIODS.map((period) => (
            <button key={period.label} type="button" role="radio" aria-checked={days === period.days} className="import-clients__period" onClick={() => setDays(period.days)}>
              {period.label}
            </button>
          ))}
        </div>
        <p className="import-clients__count" role="status">
          {count === null ? "Contando…" : count === 0 ? "Todos tus clientes de ese periodo ya están en el embudo." : <><strong>{count}</strong> {plural} para traer</>}
        </p>
        {error ? <p className="ui-error" role="alert">{error}</p> : null}
        <div className="ui-dialog__footer">
          <button type="button" className="ui-btn ui-btn--ghost" disabled={busy} onClick={onClose}>{justCreated ? "Ahora no" : "Cancelar"}</button>
          <button type="button" className="ui-btn ui-btn--primary" disabled={busy || !count} onClick={() => void bring()}>
            {busy ? "Trayendo…" : count ? `Traer ${count} ${plural}` : "Traer"}
          </button>
        </div>
      </div>
    </div>
  );
}
