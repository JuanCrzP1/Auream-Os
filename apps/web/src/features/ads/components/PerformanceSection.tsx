import "./performance-section.css";
import { useEffect, useState } from "react";
import type { AdLevel, AdsDashboardResponse } from "@contracts/DashboardContracts";
import { adsApi } from "@shared/ads/adsApi";
import { AdsPerformanceTable } from "@shared/ads/AdsPerformanceTable";
import { formatRoas } from "@shared/ads/adsFormat";
import { timeAgo } from "@shared/format/timeAgo";

const LEVELS: ReadonlyArray<readonly [AdLevel, string]> = [["campaign", "Campañas"], ["adset", "Conjuntos"], ["ad", "Anuncios"]];
const DAY = (offset: number) => new Date(Date.now() - offset * 86_400_000).toISOString().slice(0, 10);
const PERIODS = [["7", "7 días"], ["30", "30 días"], ["90", "90 días"]] as const;

/**
 * Meta Ads → Rendimiento: cada campaña, conjunto o anuncio con su gasto y lo
 * que vendió de verdad frente a lo que dice Meta. Sin cuentas conectadas,
 * lleva a Cuentas.
 */
export function PerformanceSection({ onConnectAccount }: { readonly onConnectAccount: () => void }) {
  const [level, setLevel] = useState<AdLevel>("campaign");
  const [days, setDays] = useState<string>("30");
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
        <div className="ads-performance__group" role="group" aria-label="Periodo">
          {PERIODS.map(([id, label]) => (
            <button key={id} type="button" aria-pressed={days === id} className="ads-performance__toggle" onClick={() => setDays(id)}>{label}</button>
          ))}
        </div>
        <span className="ui-muted ads-performance__sync">
          ROAS real {formatRoas(data.totals.roas)} · Meta dice {formatRoas(data.totals.roasMeta)}{data.lastSyncedAt ? ` · actualizado ${timeAgo(data.lastSyncedAt)}` : ""}
        </span>
      </div>
      {data.rows.length === 0 ? <p className="ui-muted">Sin gasto ni ventas por anuncio en este periodo.</p> : <AdsPerformanceTable data={data} />}
    </div>
  );
}
