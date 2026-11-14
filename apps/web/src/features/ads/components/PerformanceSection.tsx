import "./performance-section.css";
import { useEffect, useState } from "react";
import { salesUnknown } from "@contracts/AdMeasurementContracts";
import type { AdLevel, AdsDashboardResponse } from "@contracts/DashboardContracts";
import { adsApi } from "@shared/ads/adsApi";
import { AdsPerformanceTable } from "@shared/ads/AdsPerformanceTable";
import { formatRoas } from "@shared/ads/adsFormat";
import { MeasurementNotice } from "@shared/ads/MeasurementNotice";
import { timeAgo } from "@shared/format/timeAgo";
import { RepeatView } from "./repeat/RepeatView";

const LEVELS: ReadonlyArray<readonly [AdLevel, string]> = [["campaign", "Campañas"], ["adset", "Conjuntos"], ["ad", "Anuncios"]];
/** El día de hace `offset` días en la hora de quien mira (no en UTC: a las 7 p. m. de Colombia ya sería mañana). */
const DAY = (offset: number) => {
  const date = new Date();
  date.setDate(date.getDate() - offset);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};
const PERIODS = [["7", "7 días"], ["30", "30 días"], ["90", "90 días"]] as const;
const VIEWS = [["period", "Ventas del periodo"], ["repeat", "Con recompras"]] as const;

/**
 * Meta Ads → Rendimiento: cada campaña, conjunto o anuncio con su gasto y lo
 * que vendió de verdad frente a lo que dice Meta, o («Con recompras») los
 * clientes nuevos que trajo y lo que volvieron a comprar. Si Auream no ve los
 * chats o las ventas de esos anuncios, lo avisa y no da ROAS real. Sin cuentas
 * conectadas, lleva a Cuentas.
 */
export function PerformanceSection({ onConnectAccount }: { readonly onConnectAccount: () => void }) {
  const [level, setLevel] = useState<AdLevel>("campaign");
  const [days, setDays] = useState<string>("30");
  const [view, setView] = useState<(typeof VIEWS)[number][0]>("period");
  const [data, setData] = useState<AdsDashboardResponse | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    setFailed(false);
    adsApi.performance({ from: DAY(Number(days) - 1), to: DAY(0) }, level).then((response) => alive && setData(response)).catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [level, days]);

  if (failed) return <p className="ui-error" role="alert">No pudimos cargar el rendimiento. Vuelve a intentarlo en unos segundos.</p>;
  if (!data) return <div className="ads-performance__loading" aria-busy="true" aria-label="Cargando el rendimiento" />;
  if (!data.connected) {
    return (
      <div className="ads-performance__empty">
        <h2>Conecta tus cuentas para ver el rendimiento</h2>
        <p className="ui-muted">Gasto, chats, ventas reales, ganancia y ROAS de cada campaña y anuncio.</p>
        <button type="button" className="ui-btn ui-btn--primary" onClick={onConnectAccount}>Ir a Cuentas</button>
      </div>
    );
  }
  return (
    <div className="ads-performance">
      <div className="ads-performance__bar">
        <div className="ads-performance__group" role="tablist" aria-label="Nivel">
          {LEVELS.map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={level === id} className="ads-performance__toggle" onClick={() => setLevel(id)}>{label}</button>
          ))}
        </div>
        <div className="ads-performance__group" role="tablist" aria-label="Vista">
          {VIEWS.map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={view === id} className="ads-performance__toggle" onClick={() => setView(id)}>{label}</button>
          ))}
        </div>
        <div className="ads-performance__group" role="group" aria-label="Periodo">
          {PERIODS.map(([id, label]) => (
            <button key={id} type="button" aria-pressed={days === id} className="ads-performance__toggle" onClick={() => setDays(id)}>{label}</button>
          ))}
        </div>
        <span className="ui-muted ads-performance__sync">
          ROAS real {salesUnknown(data.measurement, data.totals.sales) ? "sin medir" : formatRoas(data.totals.roas)} · Meta: {formatRoas(data.totals.roasMeta)}{data.lastSyncedAt ? ` · actualizado ${timeAgo(data.lastSyncedAt)}` : ""}
        </span>
      </div>
      <MeasurementNotice measurement={data.measurement} />
      {view === "repeat" ? (
        <RepeatView level={level} from={DAY(Number(days) - 1)} to={DAY(0)} />
      ) : data.rows.length === 0 ? (
        <p className="ui-muted">Sin gasto ni ventas por anuncio en este periodo.</p>
      ) : (
        <AdsPerformanceTable data={data} />
      )}
    </div>
  );
}
