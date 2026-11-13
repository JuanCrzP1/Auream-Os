import type { SystemContactField } from "@contracts/ContactFieldContracts";

/** «Del sistema»: los llena Auream; se usan igual que los tuyos y no se editan aquí. */
export function SystemFields({ fields }: { readonly fields: ReadonlyArray<SystemContactField> }) {
  return (
    <section className="cf-card cf-system" aria-label="Del sistema">
      <div className="cf-system__head">
        <span className="cf-system__lock" aria-hidden="true">
          <svg viewBox="0 0 24 24"><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
        </span>
        <div>
          <h2>Del sistema</h2>
          <p>Los llena Auream. Se usan igual que los tuyos; corregir el dato de un cliente se hace en su ficha.</p>
        </div>
      </div>
      <ul className="cf-system__grid">
        {fields.map((field) => (
          <li key={field.key} className="cf-system__item">
            <span className="cf-system__top">
              <strong>{field.label}</strong>
              <code>{`{${field.key}}`}</code>
            </span>
            <span className="cf-system__source">{field.source}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
