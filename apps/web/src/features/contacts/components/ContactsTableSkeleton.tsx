/** Filas de carga con la forma de la tabla: la página no salta al llegar los datos. */
export function ContactsTableSkeleton({ rows = 6 }: { readonly rows?: number }) {
  return (
    <div className="contacts-table-wrap contacts-skeleton" aria-busy="true" aria-label="Cargando contactos">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="contacts-skeleton__row">
          <span className="contacts-skeleton__avatar" />
          <span className="contacts-skeleton__bar contacts-skeleton__bar--name" />
          <span className="contacts-skeleton__bar contacts-skeleton__bar--phone" />
          <span className="contacts-skeleton__bar contacts-skeleton__bar--chip" />
        </div>
      ))}
    </div>
  );
}
