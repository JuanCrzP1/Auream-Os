import "./catalog-empty.css";
import { SalesIcons } from "../salesIcons";

const STEPS = [
  { title: "Crea el producto", text: "Principal, upsell o downsell." },
  { title: "Ponle precio por país", text: "Cada país en su moneda: pesos, dólares, soles…" },
  { title: "Úsalo en tu flujo", text: "Comprobante → Registrar venta." }
] as const;

/** Sin productos: para qué sirve el catálogo, en tres pasos. */
export function CatalogEmpty({ canManage, onCreate }: { readonly canManage: boolean; readonly onCreate: () => void }) {
  return (
    <section className="catalog-empty" aria-labelledby="catalog-empty-title">
      <div className="catalog-empty__head">
        <span className="catalog-empty__icon" aria-hidden="true">
          {SalesIcons.box}
        </span>
        <div>
          <h2 id="catalog-empty-title" className="catalog-empty__title">
            Crea tu catálogo
          </h2>
          <p className="catalog-empty__text">Tres pasos y tus flujos registran cada venta solos, con su producto, su monto y su moneda.</p>
        </div>
      </div>
      <ol className="catalog-empty__steps">
        {STEPS.map((step, index) => (
          <li key={step.title} className="catalog-empty__step">
            <span className="catalog-empty__number" aria-hidden="true">
              {index + 1}
            </span>
            <strong>{step.title}</strong>
            <span className="catalog-empty__text">{step.text}</span>
          </li>
        ))}
      </ol>
      {canManage ? (
        <button type="button" className="ui-btn ui-btn--primary catalog-empty__button" onClick={onCreate}>
          {SalesIcons.plus}
          Crear mi primer producto
        </button>
      ) : (
        <p className="catalog-empty__text">Pide a un administrador que cree los productos.</p>
      )}
    </section>
  );
}
