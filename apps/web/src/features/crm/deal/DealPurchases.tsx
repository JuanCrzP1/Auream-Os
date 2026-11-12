import "./deal-purchases.css";
import type { ContactPurchase } from "@contracts/CrmActivityContracts";
import type { Money, PipelineSummary } from "@contracts/CrmContracts";
import { formatMoney } from "@shared/format/formatMoney";

const DAY = new Intl.DateTimeFormat("es", { day: "numeric", month: "short" });
const DAY_MS = 86_400_000;

/** Lo comprado, por moneda (pesos y dólares no se suman); la principal primero. */
function boughtByCurrency(purchases: ReadonlyArray<ContactPurchase>): Money[] {
  const totals = new Map<string, number>();
  for (const purchase of purchases) {
    if (purchase.wonAt && purchase.value) totals.set(purchase.value.currency, (totals.get(purchase.value.currency) ?? 0) + purchase.value.amount);
  }
  return [...totals].map(([currency, amount]) => ({ amount, currency })).sort((a, b) => b.amount - a.amount);
}

/** Qué pasó con una compra: en qué etapa va, o cuándo pagó y en cuánto tiempo. */
function describe(purchase: ContactPurchase, pipeline: PipelineSummary | undefined): { readonly title: string; readonly meta: string } {
  const stage = pipeline?.stages.find((candidate) => candidate.id === purchase.stageId);
  const product = purchase.productName ?? "Compra";
  const ad = purchase.adName ? `anuncio «${purchase.adName}»` : purchase.adSourceId ? "llegó por un anuncio" : "sin anuncio";
  if (purchase.wonAt) {
    const days = Math.max(0, Math.round((Date.parse(purchase.wonAt) - Date.parse(purchase.openedAt)) / DAY_MS));
    return { title: `${product} · ${stage?.name ?? "Compró"}`, meta: `Pagó el ${DAY.format(new Date(purchase.wonAt))}${days > 0 ? ` en ${days} ${days === 1 ? "día" : "días"}` : " el mismo día"} · ${ad}` };
  }
  if (stage?.outcome === "lost") return { title: `${product} · ${stage.name}`, meta: `No compró · desde el ${DAY.format(new Date(purchase.openedAt))} · ${ad}` };
  if (!stage) return { title: `${product} · fuera del embudo`, meta: `Desde el ${DAY.format(new Date(purchase.openedAt))} · ${ad}` };
  return { title: `Abierta · en ${stage.name}`, meta: `Desde el ${DAY.format(new Date(purchase.openedAt))} · ${ad}` };
}

/**
 * Las compras del cliente (la actual y las anteriores): cuánto lleva
 * comprado, cuántas compras y desde cuándo es cliente; luego cada compra con
 * su producto, cuándo pagó, cuánto tardó y el anuncio que la trajo.
 */
export function DealPurchases({ purchases, pipelines }: { readonly purchases: ReadonlyArray<ContactPurchase>; readonly pipelines: ReadonlyArray<PipelineSummary> }) {
  if (purchases.length === 0) return null;
  const [main, ...rest] = boughtByCurrency(purchases);
  const won = purchases.filter((purchase) => purchase.wonAt);
  const open = purchases.filter((purchase) => purchase.current && !purchase.wonAt).length;
  const since = won.map((purchase) => purchase.wonAt!).sort()[0] ?? null;
  const several = new Set(purchases.map((purchase) => purchase.pipelineId)).size > 1;

  return (
    <section className="deal-drawer__section deal-purchases" aria-labelledby="deal-purchases-title">
      <h3 id="deal-purchases-title">Compras</h3>
      <div className="deal-purchases__totals">
        <div>
          <span>Lleva comprado</span>
          <strong>{main ? formatMoney(main.amount, main.currency) : "—"}</strong>
          {rest.length > 0 ? <small>+ {rest.map((total) => formatMoney(total.amount, total.currency)).join(" · ")}</small> : null}
        </div>
        <div>
          <span>Compras</span>
          <strong>{won.length}{open > 0 ? ` + ${open} abierta` : ""}</strong>
        </div>
        <div>
          <span>Cliente desde</span>
          <strong>{since ? DAY.format(new Date(since)) : "Aún no compra"}</strong>
        </div>
      </div>
      <ol className="deal-purchases__list">
        {purchases.map((purchase) => {
          const pipeline = pipelines.find((candidate) => candidate.id === purchase.pipelineId);
          const text = describe(purchase, pipeline);
          const pending = purchase.current && !purchase.wonAt;
          return (
            <li key={purchase.dealId} className={`deal-purchases__item${pending ? " is-open" : ""}`}>
              <span className="deal-purchases__number" aria-label={`Compra n.º ${purchase.number}`}>{purchase.number}</span>
              <span className="deal-purchases__text">
                <strong>{text.title}</strong>
                <small>{several && pipeline ? `${pipeline.name} · ` : ""}{text.meta}</small>
              </span>
              <span className="deal-purchases__amount">{purchase.value ? formatMoney(purchase.value.amount, purchase.value.currency) : "Sin valor"}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
