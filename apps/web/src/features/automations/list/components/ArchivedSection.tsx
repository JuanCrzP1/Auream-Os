import { useState, type ReactNode } from "react";

interface ArchivedSectionProps {
  readonly count: number;
  readonly children: ReactNode;
}

/**
 * ArchivedSection — las automatizaciones archivadas, plegadas al final del hub.
 * Cerrada por defecto: archivar es quitar de en medio, no esconder del todo.
 */
export function ArchivedSection({ count, children }: ArchivedSectionProps) {
  const [open, setOpen] = useState(false);

  return (
    <section className="hub-section hub-archived">
      <button
        type="button"
        className="hub-archived__toggle"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="hub-archived__chevron" aria-hidden="true">{open ? "▾" : "▸"}</span>
        Archivadas ({count})
      </button>
      {open ? <div className="hub-grid">{children}</div> : null}
    </section>
  );
}
