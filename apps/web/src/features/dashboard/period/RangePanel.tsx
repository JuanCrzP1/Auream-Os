import "./range-panel.css";
import { useState } from "react";
import { MonthCalendar } from "./MonthCalendar";
import {
  ALL_PRESETS, choosePeriod, daysBetween, isoDay, MAX_DAYS, presetMenuLabel, presetRange, previousRange, rangeLabel, rangeProblem, type DashboardPeriod
} from "./periodModel";

const shiftMonth = (month: string, by: number) => {
  const date = new Date(+month.slice(0, 4), +month.slice(5, 7) - 1 + by, 1);
  return isoDay(date).slice(0, 7);
};
const daysText = (days: number) => (days === 1 ? "1 día" : `${days} días`);

/**
 * El panel de «Fechas»: los atajos (se aplican al tocarlos) y dos meses para
 * elegir desde y hasta. Abajo, cuántos días son y con qué periodo se compara.
 */
export function RangePanel({ period, onApply, onClose }: {
  readonly period: DashboardPeriod;
  readonly onApply: (period: DashboardPeriod) => void;
  readonly onClose: () => void;
}) {
  const now = new Date();
  const today = isoDay(now);
  const thisMonth = today.slice(0, 7);
  const [start, setStart] = useState<string | null>(period.from);
  const [end, setEnd] = useState<string | null>(period.to);
  const [preview, setPreview] = useState<string | null>(null);
  const [month, setMonth] = useState(period.to.slice(0, 7));

  const pick = (day: string) => {
    setPreview(null);
    if (!start || end) {
      setStart(day);
      setEnd(null);
      return;
    }
    if (day < start) {
      setEnd(start);
      setStart(day);
    } else setEnd(day);
  };
  const isDisabled = (day: string) => day > today || (!!start && !end && daysBetween(day < start ? day : start, day < start ? start : day) > MAX_DAYS);

  const from = start;
  const to = end ?? start;
  const problem = from && to ? rangeProblem(from, to, now) : null;
  const before = from && to ? previousRange(from, to) : null;
  const apply = () => from && to && !problem && onApply(choosePeriod(from, to, now));

  return (
    <div className="scope-pop range-panel" role="dialog" aria-label="Elegir fechas">
      <div className="range-panel__body">
        <ul className="range-panel__presets" aria-label="Atajos">
          {ALL_PRESETS.map((id) => (
            <li key={id}>
              <button type="button" aria-pressed={period.preset === id} onClick={() => onApply({ preset: id, ...presetRange(id, now) })}>
                {presetMenuLabel(id)}
              </button>
            </li>
          ))}
        </ul>
        <div className="range-panel__months">
          <div className="range-panel__nav">
            <button type="button" aria-label="Mes anterior" onClick={() => setMonth(shiftMonth(month, -1))}>‹</button>
            <button type="button" aria-label="Mes siguiente" disabled={month >= thisMonth} onClick={() => setMonth(shiftMonth(month, 1))}>›</button>
          </div>
          {[shiftMonth(month, -1), month].map((item, index) => (
            <div key={item} className={index === 0 ? "range-panel__month range-panel__month--before" : "range-panel__month"}>
              <MonthCalendar month={item} start={start} end={end} preview={preview} isDisabled={isDisabled} onPick={pick} onPreview={setPreview} />
            </div>
          ))}
        </div>
      </div>

      <footer className="range-panel__footer">
        <div className="range-panel__summary" aria-live="polite">
          {from && to ? (
            <>
              <strong>{rangeLabel(from, to, now)}</strong> · {daysText(daysBetween(from, to))}
              {end ? null : <span className="range-panel__hint"> · toca el día final o aplica solo este</span>}
              {before && !problem ? <span className="range-panel__compare">Se compara con {rangeLabel(before.from, before.to, now)}</span> : null}
              {problem ? <span className="range-panel__problem">{problem}</span> : null}
            </>
          ) : <span className="range-panel__hint">Toca el día de inicio</span>}
        </div>
        <div className="range-panel__actions">
          <button type="button" className="ui-btn ui-btn--ghost" onClick={onClose}>Cancelar</button>
          <button type="button" className="ui-btn ui-btn--primary" disabled={!from || !!problem} onClick={apply}>Aplicar</button>
        </div>
      </footer>
    </div>
  );
}
