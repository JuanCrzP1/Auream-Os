import "../components/contacts.css";
import { useState } from "react";
import type { ContactSummary } from "@contracts/ContactContracts";
import { useLabelCatalog } from "@shared/labels/useLabelCatalog";
import { useContactList } from "../hooks/useContactList";
import { ContactsTable } from "../components/ContactsTable";
import { ContactDrawer } from "../components/ContactDrawer";
import { NewContactDialog } from "../components/NewContactDialog";
import { LabelsManager } from "../components/LabelsManager";

type Tab = "contacts" | "labels";

/**
 * ContactsPage — los contactos de la cuenta y su catálogo de etiquetas.
 *
 * Los flujos crean y etiquetan contactos solos (bloque Etiquetas, preguntas
 * que guardan respuestas); aquí se consultan y se corrigen a mano.
 */
export function ContactsPage() {
  const [tab, setTab] = useState<Tab>("contacts");
  const [open, setOpen] = useState<ContactSummary | null>(null);
  const [creating, setCreating] = useState(false);
  const list = useContactList();
  const catalog = useLabelCatalog();

  // Al cambiar etiquetas cambian los contadores del catálogo y las fichas.
  const afterLabelChange = () => void list.reload();

  return (
    <div className="contacts-shell">
      <header className="contacts-header">
        <div>
          <h1 className="contacts-header__title">Contactos</h1>
          <p className="contacts-header__subtitle">Las personas que escriben a tus conexiones, sus etiquetas y los datos que guardan tus flujos.</p>
        </div>
        {tab === "contacts" ? (
          <button type="button" className="contacts-btn contacts-btn--primary" onClick={() => setCreating(true)}>
            Nuevo contacto
          </button>
        ) : null}
      </header>

      <nav className="contacts-tabs" role="tablist" aria-label="Secciones">
        <button type="button" role="tab" aria-selected={tab === "contacts"} className="contacts-tab" onClick={() => setTab("contacts")}>
          Contactos
        </button>
        <button type="button" role="tab" aria-selected={tab === "labels"} className="contacts-tab" onClick={() => setTab("labels")}>
          Etiquetas{catalog.labels.length > 0 ? ` · ${catalog.labels.length}` : ""}
        </button>
      </nav>

      {tab === "contacts" ? (
        <section className="contacts-panel" aria-label="Contactos">
          <div className="contacts-toolbar">
            <input
              className="contacts-input contacts-toolbar__search"
              type="search"
              value={list.search}
              placeholder="Buscar por nombre, teléfono o correo"
              aria-label="Buscar contactos"
              onChange={(e) => list.setSearch(e.target.value)}
            />
            <select
              className="contacts-input contacts-toolbar__filter"
              value={list.labelId ?? ""}
              aria-label="Filtrar por etiqueta"
              onChange={(e) => list.setLabelId(e.target.value || null)}
            >
              <option value="">Todas las etiquetas</option>
              {catalog.labels.map((label) => (
                <option key={label.id} value={label.id}>{label.name}</option>
              ))}
            </select>
          </div>

          {list.status === "error" ? (
            <p className="contacts-error" role="alert">
              No se pudieron cargar los contactos.{" "}
              <button type="button" className="contacts-link" onClick={() => void list.reload()}>Reintentar</button>
            </p>
          ) : list.contacts.length === 0 && list.status === "ready" ? (
            <p className="contacts-empty">
              {list.search || list.labelId ? "Ningún contacto coincide con la búsqueda." : "Aún no hay contactos. Llegarán solos cuando alguien escriba a una de tus conexiones."}
            </p>
          ) : (
            <ContactsTable contacts={list.contacts} onOpen={setOpen} />
          )}

          {list.page > 1 || list.hasMore ? (
            <div className="contacts-pager">
              <button type="button" className="contacts-btn contacts-btn--ghost" disabled={list.page <= 1} onClick={() => list.setPage(list.page - 1)}>Anterior</button>
              <span className="contacts-muted">Página {list.page}</span>
              <button type="button" className="contacts-btn contacts-btn--ghost" disabled={!list.hasMore} onClick={() => list.setPage(list.page + 1)}>Siguiente</button>
            </div>
          ) : null}
        </section>
      ) : (
        <LabelsManager
          labels={catalog.labels}
          onCreate={catalog.create}
          onUpdate={async (id, input) => {
            await catalog.update(id, input);
            afterLabelChange();
          }}
          onDelete={async (id) => {
            await catalog.remove(id);
            afterLabelChange();
          }}
        />
      )}

      {open ? (
        <ContactDrawer
          contact={open}
          catalog={catalog.labels}
          onSaved={(saved) => {
            list.replace(saved);
            void catalog.refresh();
          }}
          onClose={() => setOpen(null)}
        />
      ) : null}
      {creating ? (
        <NewContactDialog
          onCreated={(created) => {
            setCreating(false);
            void list.reload();
            setOpen(created);
          }}
          onClose={() => setCreating(false)}
        />
      ) : null}
    </div>
  );
}
