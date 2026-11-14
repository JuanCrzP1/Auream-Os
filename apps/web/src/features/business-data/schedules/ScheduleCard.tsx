import { useState } from "react";
import { businessValueText, type BusinessDataType, type BusinessDataUse } from "@contracts/BusinessDataContracts";
import { scheduleState, type BusinessDataSchedule } from "@contracts/BusinessDataTimeline";
import { apiErrorMessage } from "@shared/http/apiErrorMessage";
import { broadcastsDuring, lengthLabel, momentLabel, stateLabel } from "./scheduleText";

const CALENDAR = (
  <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M8 3v4M16 3v4M3 10h18" /></svg>
);
const WARNING = (
  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 9v4M12 17h.01" /><path d="M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /></svg>
);

/**
 * Un cambio programado: su nombre, si empieza pronto o ya rige, sus fechas en
 * la hora de la empresa, el valor y las difusiones que saldrán con él. Quitar
 * (o terminar ya, si rige) se confirma ahí mismo.
 */
export function ScheduleCard({
  schedule,
  type,
  usualValue,
  uses,
  timeZone,
  now,
  canManage,
  onEdit,
  onRemove
}: {
  readonly schedule: BusinessDataSchedule;
  readonly type: BusinessDataType;
  readonly usualValue: string;
  readonly uses: ReadonlyArray<BusinessDataUse>;
  readonly timeZone: string;
  readonly now: Date;
  readonly canManage: boolean;
  readonly onEdit: () => void;
  readonly onRemove: () => Promise<unknown>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const active = scheduleState(schedule, now) === "active";
  const name = schedule.note || "Cambio programado";
  const broadcasts = broadcastsDuring(uses, schedule);

  const remove = async () => {
    setBusy(true);
    setError(null);
    try {
      await onRemove();
    } catch (e) {
      setError(apiErrorMessage(e, "No se pudo quitar el cambio."));
      setBusy(false);
    }
  };

  return (
    <article className={`bd-schedule${active ? " is-active" : ""}`} aria-label={`${name} · ${stateLabel(schedule, now)}`}>
      <header>
        <strong><span className="bd-schedule__icon">{CALENDAR}</span>{name}</strong>
        <span className="bd-schedule__state">{stateLabel(schedule, now)}</span>
      </header>
      <p className="bd-schedule__range">
        {momentLabel(schedule.startsAt, timeZone, now)} → {momentLabel(schedule.endsAt, timeZone, now)} <small>{lengthLabel(schedule)}</small>
      </p>
      <p className="bd-schedule__value">{businessValueText({ type, value: schedule.value })}</p>
      {broadcasts.map((broadcast) => (
        <p key={broadcast.name + broadcast.sendAt} className="bd-schedule__note">
          {WARNING}La difusión «{broadcast.name}» sale el {momentLabel(broadcast.sendAt, timeZone, now)}: dirá este valor.
        </p>
      ))}
      {error ? <p className="ui-error" role="alert">{error}</p> : null}
      {canManage ? (
        confirming ? (
          <div className="bd-schedule__confirm" role="group" aria-label="Confirmar">
            <span>{active ? `¿Terminar ya? Vuelve «${businessValueText({ type, value: usualValue })}».` : `¿Quitar «${name}»?`}</span>
            <button type="button" className="bd-schedule__btn" onClick={() => setConfirming(false)} disabled={busy}>No</button>
            <button type="button" className="bd-schedule__btn is-danger" onClick={() => void remove()} disabled={busy}>
              {busy ? "Un momento…" : active ? "Sí, terminar" : "Sí, quitar"}
            </button>
          </div>
        ) : (
          <div className="bd-schedule__actions">
            <button type="button" className="bd-schedule__btn" onClick={onEdit}>Editar</button>
            <button type="button" className="bd-schedule__btn is-danger" onClick={() => setConfirming(true)}>{active ? "Terminar ya" : "Quitar"}</button>
          </div>
        )
      ) : null}
    </article>
  );
}
