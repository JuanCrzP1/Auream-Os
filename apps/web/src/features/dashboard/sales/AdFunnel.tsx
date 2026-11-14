import "./ad-funnel.css";
import { salesUnknown } from "@contracts/AdMeasurementContracts";
import type { SalesDashboardResponse } from "@contracts/DashboardContracts";
import { MetaTag } from "@shared/ads/MetaTag";
import { money } from "../dashboardFormat";

/**
 * Del anuncio a la venta: cuántos llegan a cada paso, qué parte sigue y lo
 * que cuesta cada uno. Las ventas son las anotadas en Auream; si Auream no
 * las ve, «Compraron» no es 0: van las compras que reporta Meta, con su etiqueta.
 */
export function AdFunnel({ view }: { readonly view: SalesDashboardResponse }) {
  const funnel = view.funnel!;
  const ads = view.ads!;
  const spend = ads.spend.value;
  const blind = salesUnknown(ads.measurement, ads.attributedSales);
  const per = (n: number, factor = 1) => (n > 0 ? money((spend / n) * factor, view.currency) : "—");
  const steps: ReadonlyArray<{ readonly name: string; readonly value: number; readonly cost: string; readonly color: string; readonly meta?: true }> = [
    { name: "Vieron el anuncio", value: funnel.impressions, cost: `CPM ${per(funnel.impressions, 1000)}`, color: "#a78bfa" },
    { name: "Hicieron clic", value: funnel.clicks, cost: `costo por clic ${per(funnel.clicks)}`, color: "#8b5cf6" },
    { name: "Escribieron", value: funnel.chats, cost: `costo por chat ${per(funnel.chats)}`, color: "#6c5ce7" },
    blind
      ? { name: "Compraron", value: ads.metaPurchases, cost: `costo por compra ${per(ads.metaPurchases)}`, color: "#0d9488", meta: true }
      : { name: "Compraron", value: funnel.sales, cost: `costo por venta ${per(funnel.sales)}`, color: "#0d9488" }
  ];
  const rate = (from: number, to: number) => (from > 0 ? `${((to / from) * 100).toLocaleString("es-CO", { maximumFractionDigits: 1 })} %` : "—");
  const verbs = ["hace clic", "escribe", "compra"];
  return (
    <section className="ad-funnel" aria-labelledby="ad-funnel-title">
      <header className="ad-funnel__header">
        <h2 id="ad-funnel-title">Del anuncio a la venta</h2>
        <span className="ui-muted">Cuántos llegan a cada paso y lo que te cuesta cada uno</span>
      </header>
      <ol className="ad-funnel__steps">
        {steps.map((step, i) => (
          <li key={step.name} className="ad-funnel__step" style={{ ["--step-color" as string]: step.color, ["--step-width" as string]: `${100 - i * 12}%` }}>
            <span className="ad-funnel__name"><span className="ad-funnel__dot" aria-hidden="true" />{step.name}</span>
            <strong className="ad-funnel__value">{step.value.toLocaleString("es-CO")}{step.meta ? <> <MetaTag /></> : null}</strong>
            <span className="ad-funnel__cost">{step.cost}</span>
            <span className="ad-funnel__band" aria-hidden="true" />
            {i < steps.length - 1 ? <span className="ad-funnel__rate">{rate(step.value, steps[i + 1]!.value)} {verbs[i]}</span> : null}
          </li>
        ))}
      </ol>
    </section>
  );
}
