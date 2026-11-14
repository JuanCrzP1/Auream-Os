import "@shared/ads/ads-performance-table.css";
import "./campaign-advice.css";
import type { AdsDashboardResponse } from "@contracts/DashboardContracts";
import { ADVICE_LABEL, formatRoas } from "@shared/ads/adsFormat";
import { MetaTag } from "@shared/ads/MetaTag";
import { metaBeside } from "@shared/ads/metaSource";
import { money } from "../dashboardFormat";

/**
 * «Qué hacer con tus campañas»: las de más gasto con su consejo, ROAS real,
 * ganancia y costo por venta. Sin ventas de la campaña en Auream, el ROAS y el
 * costo por compra son los que reporta Meta, con su etiqueta; la ganancia espera.
 */
export function CampaignAdvice({ data, onSeeAll }: { readonly data: AdsDashboardResponse; readonly onSeeAll: () => void }) {
  const rows = data.rows.slice(0, 5);
  return (
    <section className="campaign-advice" aria-labelledby="campaign-advice-title">
      <header className="campaign-advice__header">
        <h2 id="campaign-advice-title">Qué hacer con tus campañas</h2>
        <button type="button" className="ui-link campaign-advice__all" onClick={onSeeAll}>Ver todas →</button>
      </header>
      {rows.length === 0 ? <p className="ui-muted campaign-advice__empty">Sin gasto en este periodo.</p> : null}
      <ul className="campaign-advice__list">
        {rows.map((row) => (
          <li key={row.id} className="campaign-advice__row">
            <span className={`ads-table__advice ads-table__advice--${row.advice}`}>{ADVICE_LABEL[row.advice]}</span>
            <span className="campaign-advice__name"><strong>{row.name}</strong><span>{row.adviceReason}</span></span>
            {row.roas === null && row.roasMeta !== null ? (
              <span className="campaign-advice__metric"><strong>{formatRoas(row.roasMeta)} <MetaTag /></strong><span>ROAS</span></span>
            ) : (
              <span className="campaign-advice__metric"><strong className={row.roas !== null && row.roas >= 3 ? "ads-table__good" : row.roas !== null && row.roas < 1 ? "ads-table__bad" : undefined}>{formatRoas(row.roas)}</strong><span>ROAS real{row.roasMeta !== null ? ` · ${metaBeside(formatRoas(row.roasMeta))}` : ""}</span></span>
            )}
            <span className="campaign-advice__metric"><strong className={row.profit === null || row.profit >= 0 ? undefined : "ads-table__bad"}>{row.profit !== null && row.profit < 0 ? "−" : ""}{money(row.profit === null ? null : Math.abs(row.profit), data.currency)}</strong><span>ganancia</span></span>
            {row.costPerSale === null && row.costPerSaleMeta !== null ? (
              <span className="campaign-advice__metric"><strong>{money(row.costPerSaleMeta, data.currency)} <MetaTag /></strong><span>costo por compra</span></span>
            ) : (
              <span className="campaign-advice__metric"><strong>{money(row.costPerSale, data.currency)}</strong><span>costo por venta{row.costPerSaleMeta !== null ? ` · ${metaBeside(money(row.costPerSaleMeta, data.currency))}` : ""}</span></span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
