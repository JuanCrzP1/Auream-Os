import "./history.css";
import { useCallback, useEffect, useState } from "react";
import { BUSINESS_HISTORY_LIMIT, type BusinessDataChange } from "@contracts/BusinessDataTimeline";
import type { BusinessDatumSummary } from "@contracts/BusinessDataContracts";
import { businessValueText } from "@contracts/BusinessDataContracts";
import { fetchBusinessDataHistory } from "@shared/business-data/businessDataApi";
import { timeAgo } from "@shared/format/timeAgo";
import { apiErrorMessage } from "@shared/http/apiErrorMessage";
import { momentLabel } from "../schedules/scheduleText";
import { historyLine, initialOf } from "./historyText";

/** Hasta una semana, «hace 2 h»; después, el día y la hora. */
const whenLabel = (at: string, timeZone: string, now: Date) => (now.getTime() - Date.parse(at) < 7 * 86_400_000 ? timeAgo(at, now.getTime()) : momentLabel(at, timeZone, now));

/**
 * La pestaña «Historial»: quién cambió qué y cuándo, del más reciente al más
 * viejo. «Volver a este valor» pone el de antes como un cambio más (no borra
 * nada). Se vuelve a pedir cada vez que el dato cambia.
 */
export function HistoryTab({
  datum,
  timeZone,
  now,
  canManage,
  onRestore
}: {
  readonly datum: BusinessDatumSummary;
  readonly timeZone: string;
  readonly now: Date;
  readonly canManage: boolean;
  readonly onRestore: (value: string) => Promise<unknown>;
}) {
  const [changes, setChanges] = useState<ReadonlyArray<BusinessDataChange> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [restoring, setRestoring] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setChanges((await fetchBusinessDataHistory(datum.id)).changes);
      setError(null);
    } catch (e) {
      setError(apiErrorMessage(e, "No pudimos cargar el historial."));
    }
  }, [datum.id]);

  // El dato cambió (guardar, programar, volver a un valor): el historial también.
  useEffect(() => {
    void load();
  }, [load, datum.updatedAt, datum.schedules]);

  const restore = async (change: BusinessDataChange, value: string) => {
    setRestoring(change.id);
    setError(null);
    try {
      await onRestore(value);
    } catch (e) {
      setError(apiErrorMessage(e, "No se pudo volver a ese valor."));
    } finally {
      setRestoring(null);
    }
  };

  if (!changes && !error) return <div className="bd-drawer__body"><div className="bd-history__loading" aria-busy="true" aria-label="Cargando historial" /></div>;

  return (
    <div className="bd-drawer__body">
      {error ? <p className="ui-error" role="alert">{error}</p> : null}
      {changes && changes.length === 0 ? <p className="bd-history__empty">Aún no hay cambios anotados. Desde ahora, cada cambio queda aquí con quién lo hizo.</p> : null}
      {changes && changes.length > 0 ? (
        <ol className="bd-history" aria-label="Historial">
          {changes.map((change, index) => {
            const line = historyLine(change);
            // Un solo «Volver a…» por valor: en la línea más reciente que lo ofrece.
            const offeredBefore = changes.slice(0, index).some((other) => historyLine(other).restore === line.restore && other.valueType === datum.type);
            const canRestore = canManage && line.restore !== undefined && line.restore !== datum.value && change.valueType === datum.type && !offeredBefore;
            return (
              <li key={change.id}>
                <span className="bd-history__avatar" aria-hidden="true">{initialOf(line.who)}</span>
                <div>
                  <p>
                    <b>{line.who}</b>
                    {line.pieces.map((piece, index) =>
                      piece.mark === "before" ? <del key={index}>{piece.text}</del> : piece.mark === "after" || piece.mark === "name" ? <strong key={index}>{piece.text}</strong> : <span key={index}>{piece.text}</span>
                    )}
                  </p>
                  <small>
                    {line.schedule ? `${momentLabel(line.schedule.startsAt, timeZone, now)} → ${momentLabel(line.schedule.endsAt, timeZone, now)} · ` : ""}
                    {whenLabel(change.at, timeZone, now)}
                  </small>
                  {canRestore ? (
                    <button type="button" className="bd-history__restore" disabled={restoring !== null} onClick={() => void restore(change, line.restore!)}>
                      {restoring === change.id ? "Volviendo…" : `Volver a «${businessValueText({ type: datum.type, value: line.restore! })}»`}
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      ) : null}
      <p className="bd-history__foot">Se guardan los últimos {BUSINESS_HISTORY_LIMIT} cambios de cada dato. «Volver a este valor» no borra nada: queda como un cambio más.</p>
    </div>
  );
}
