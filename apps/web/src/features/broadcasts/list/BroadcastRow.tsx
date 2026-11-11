import "./broadcast-row.css";
import type { BroadcastSummary } from "@contracts/BroadcastResultsContracts";
import { count, money, percent, progress, STATUS, timeline, whatItSends } from "../broadcastFormat";

/** Una difusión en la lista: qué y a quién, su estado con el avance, y del envío a la venta. */
export function BroadcastRow({ broadcast, onOpen }: { readonly broadcast: BroadcastSummary; readonly onOpen: (id: string) => void }) {
  const { stats } = broadcast;
  const status = STATUS[broadcast.status];
  const revenue = money(stats.revenue);
  const started = stats.total > 0;
  return (
    <button type="button" className="bc-row" onClick={() => onOpen(broadcast.id)} aria-label={`Abrir ${broadcast.name}`}>
      <span className="bc-row__name">
        <strong>{broadcast.name}</strong>
        <span className="bc-row__what">
          {broadcast.parentName ? `Segundo envío de «${broadcast.parentName}»` : whatItSends(broadcast)} · {broadcast.connections.map((c) => c.name).join(", ")}
        </span>
      </span>
      <span className="bc-row__state">
        <span className={`bc-badge bc-badge--${status.tone}`}>
          {status.label}
          {broadcast.status === "sending" && started ? ` · ${progress(stats)} %` : ""}
        </span>
        <span className="bc-row__bar" aria-hidden="true">
          <span className={`bc-row__fill bc-row__fill--${status.tone}`} style={{ width: `${started ? progress(stats) : 0}%` }} />
        </span>
        <span className="bc-row__when">{broadcast.statusReason && broadcast.status === "auto_paused" ? "revisa el motivo" : timeline(broadcast)}</span>
      </span>
      <Metric value={started ? count(stats.sent) : "—"} label="enviados" />
      <Metric value={started ? percent(stats.read, stats.sent) : "—"} label="leyeron" />
      <Metric value={started ? count(stats.replied) : "—"} label="respondieron" />
      <Metric value={started ? count(stats.bought) : "—"} label="compraron" />
      <span className="bc-row__money">
        <strong>{started ? revenue.main : "—"}</strong>
        <span>{revenue.others > 0 ? `+ ${revenue.others} moneda${revenue.others > 1 ? "s" : ""}` : "vendido"}</span>
      </span>
    </button>
  );
}

function Metric({ value, label }: { readonly value: string; readonly label: string }) {
  return (
    <span className="bc-row__metric">
      <strong>{value}</strong>
      <span>{label}</span>
    </span>
  );
}
