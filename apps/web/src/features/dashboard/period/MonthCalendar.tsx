import "./month-calendar.css";
import { WEEKDAYS } from "../dashboardFormat";
import { dateOf, isoDay } from "./periodModel";

const TITLE = new Intl.DateTimeFormat("es", { month: "long", year: "numeric" });
const FULL = new Intl.DateTimeFormat("es", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

/** Los días de un mes (`YYYY-MM`) en semanas que empiezan el lunes; `null` = hueco. */
export function monthGrid(month: string): ReadonlyArray<string | null> {
  const first = new Date(+month.slice(0, 4), +month.slice(5, 7) - 1, 1);
  const length = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const lead = (first.getDay() + 6) % 7;
  const days = Array.from({ length }, (_, i) => isoDay(new Date(first.getFullYear(), first.getMonth(), i + 1)));
  const cells: Array<string | null> = [...Array.from({ length: lead }, () => null), ...days];
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export const monthTitle = (month: string) => TITLE.format(dateOf(`${month}-01`)).replace(" de ", " ");

/**
 * Un mes para elegir un rango: el primer toque marca el inicio y el segundo
 * el final; mientras tanto, pasar el mouse muestra cómo quedaría.
 */
export function MonthCalendar({ month, start, end, preview, isDisabled, onPick, onPreview }: {
  readonly month: string;
  readonly start: string | null;
  readonly end: string | null;
  /** El día bajo el mouse cuando falta el final. */
  readonly preview: string | null;
  readonly isDisabled: (day: string) => boolean;
  readonly onPick: (day: string) => void;
  readonly onPreview: (day: string | null) => void;
}) {
  const today = isoDay(new Date());
  const last = end ?? (start && preview ? preview : null);
  const [low, high] = start && last ? (last < start ? [last, start] : [start, last]) : [start, start];

  return (
    <div className="month-calendar">
      <p className="month-calendar__title">{monthTitle(month)}</p>
      <div className="month-calendar__grid" role="group" aria-label={monthTitle(month)} onMouseLeave={() => onPreview(null)}>
        {WEEKDAYS.map((weekday) => <span key={weekday} className="month-calendar__weekday" aria-hidden="true">{weekday.slice(0, 2)}</span>)}
        {monthGrid(month).map((day, index) => {
          if (!day) return <span key={`gap-${index}`} />;
          const inside = !!low && !!high && day > low && day < high;
          const edge = day === low || day === high;
          const classes = ["month-calendar__day", inside ? "is-inside" : "", edge ? "is-edge" : "", day === low && high && high !== low ? "is-start" : "", day === high && low && high !== low ? "is-end" : "", day === today ? "is-today" : ""];
          return (
            <button
              key={day}
              type="button"
              className={classes.filter(Boolean).join(" ")}
              disabled={isDisabled(day)}
              aria-pressed={edge}
              aria-label={FULL.format(dateOf(day))}
              onClick={() => onPick(day)}
              onMouseEnter={() => onPreview(day)}
            >
              {+day.slice(8, 10)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
