import "./review-empty.css";

/** «Por revisar» sin pendientes: lo dice con calma y explica qué llega aquí. */
export function ReviewEmpty() {
  return (
    <section className="review-empty" aria-labelledby="review-empty-title">
      <svg viewBox="0 0 160 120" width="160" height="120" aria-hidden="true">
        <rect x="34" y="14" width="92" height="96" rx="16" className="review-empty__sheet" />
        <rect x="50" y="34" width="60" height="8" rx="4" className="review-empty__line" />
        <rect x="50" y="50" width="44" height="8" rx="4" className="review-empty__line" />
        <rect x="50" y="66" width="52" height="8" rx="4" className="review-empty__line" />
        <circle cx="116" cy="86" r="22" className="review-empty__check" />
        <path d="M106 86l7 7 13-14" fill="none" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <h2 id="review-empty-title" className="review-empty__title">
        Todo al día
      </h2>
      <p className="review-empty__text">
        Aquí llegan las ventas a las que les falta algo: un comprobante sin monto, un cliente de un país sin precio o un producto archivado. No suman hasta que alguien las complete.
      </p>
      <ul className="review-empty__reasons" aria-label="Lo que puede dejar una venta por revisar">
        <li>Falta el monto</li>
        <li>Sin precio en ese país</li>
        <li>Producto archivado</li>
      </ul>
    </section>
  );
}
