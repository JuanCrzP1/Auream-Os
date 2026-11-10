import "./heatmap.css";
import type { AttentionDashboardResponse } from "@contracts/AttentionContracts";
import { WEEKDAYS } from "../dashboardFormat";

const BLOCKS = Array.from({ length: 12 }, (_, i) => i * 2);
const WEEKDAY_NAMES = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábados", "domingos"];
const hourText = (hour: number) => `${hour % 12 || 12} ${hour < 12 ? "a. m." : "p. m."}`;

/** Cuándo te escriben: chats nuevos por día y franja de 2 horas, con el pico. */
export function Heatmap({ grid, peak }: { readonly grid: ReadonlyArray<ReadonlyArray<number>>; readonly peak: AttentionDashboardResponse["peak"] }) {
  const max = Math.max(1, ...grid.flat());
  return (
    <section className="attention-heatmap" aria-labelledby="heatmap-title">
      <header>
        <h2 id="heatmap-title">Cuándo te escriben</h2>
        <span className="ui-muted">{peak ? <>Pico: <strong>{WEEKDAY_NAMES[peak.weekday]}, de {hourText(peak.hour)} a {hourText(peak.hour + 2)}</strong> ({peak.chats} chats). Ten asesores a esa hora.</> : "Aún sin chats en este periodo."}</span>
      </header>
      <div className="attention-heatmap__scroll">
        <table className="attention-heatmap__grid">
          <thead>
            <tr><th scope="col"><span className="attention-heatmap__sr">Día</span></th>{BLOCKS.map((hour) => <th key={hour} scope="col">{hour} h</th>)}</tr>
          </thead>
          <tbody>
            {grid.map((row, day) => (
              <tr key={WEEKDAYS[day]}>
                <th scope="row">{WEEKDAYS[day]}</th>
                {row.map((count, block) => (
                  <td key={block} title={`${WEEKDAYS[day]} ${block * 2} a ${block * 2 + 2} h: ${count} chats`}>
                    <span className="attention-heatmap__cell" style={{ opacity: count === 0 ? 0.08 : 0.2 + (count / max) * 0.8 }} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
