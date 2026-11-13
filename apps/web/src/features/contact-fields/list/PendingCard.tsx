/** «Por ordenar»: datos que tus flujos ya guardan y aún no son campos. Nada cambia hasta que lo confirmes. */
export function PendingCard({ pending, onReview }: { readonly pending: number; readonly onReview: () => void }) {
  return (
    <section className="cf-pending" aria-label="Para ordenar">
      <div className="cf-pending__head">
        <strong>{pending === 1 ? "1 cosa por ordenar" : `${pending} cosas por ordenar`}</strong>
        <span>Nada cambia hasta que lo confirmes</span>
      </div>
      <div className="cf-pending__item">
        <span className="cf-pending__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></svg>
        </span>
        <div className="cf-pending__text">
          <strong>{pending === 1 ? "Tus flujos guardan 1 dato que aún no es un campo" : `Tus flujos guardan ${pending} datos que aún no son campos`}</strong>
          <span>Te proponemos el nombre y el tipo de cada uno; tú eliges cuáles convertir.</span>
        </div>
        <button type="button" className="cf-soft-btn" onClick={onReview}>Revisar</button>
      </div>
    </section>
  );
}
