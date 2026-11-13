import { Link } from "react-router-dom";

/**
 * Los precios no van en Datos del negocio: viven en Productos (por país), que
 * es lo que usan Registrar venta y el ROAS. Un precio escrito aquí se
 * desincronizaría del de la venta.
 */
export function PricesCard() {
  return (
    <aside className="bd-prices" aria-label="¿Precios?">
      <span className="bd-prices__icon" aria-hidden="true">
        <svg viewBox="0 0 24 24"><path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8zM7.5 7.5h.01" /></svg>
      </span>
      <span className="bd-prices__text">
        <strong>¿Precios? Van en Productos</strong>
        <span>Allí cada producto tiene su precio por país, y es el que usan Registrar venta y tu ROAS. Así nunca le dices un precio al cliente y anotas otro.</span>
      </span>
      <Link className="bd-soft-btn" to="/sales?tab=products">Ir a Productos</Link>
    </aside>
  );
}
