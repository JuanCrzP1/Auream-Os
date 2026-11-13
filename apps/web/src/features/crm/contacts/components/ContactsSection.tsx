import "@shared/ui/page/page.css";
import "@shared/ui/controls/controls.css";
import "./contacts.css";
import "./contacts-section.css";
import { useState } from "react";
import { Link } from "react-router-dom";
import type { ContactSummary } from "@contracts/ContactContracts";
import { useLabelCatalog } from "@shared/labels/useLabelCatalog";
import { useContactList } from "../hooks/useContactList";
import { ContactsTable } from "./ContactsTable";
import { ContactDrawer } from "./ContactDrawer";
import { FieldFilterEditor } from "@shared/contact-fields/FieldFilterEditor";
import { useContactFieldCatalog } from "@shared/contact-fields/useContactFieldCatalog";
import { NewContactDialog } from "./NewContactDialog";
import { ContactsTableSkeleton } from "./ContactsTableSkeleton";
import { RetryButton, StateCard } from "@shared/ui/state/StateCard";
import { StateIcons } from "@shared/ui/state/stateIcons";

/**
 * ContactsSection — la pestaña «Contactos» del CRM: los contactos de la
 * cuenta. Las etiquetas (las etapas de los embudos también lo son) se
 * administran en Configuración › Datos › Etiquetas: dónde trabaja cada una,
 * unir las repetidas y borrar sin romper nada.
 *
 * Los flujos crean y etiquetan contactos solos (bloque Etiquetas, preguntas
 * que guardan respuestas); aquí se consultan y se corrigen a mano.
 */
export function ContactsSection() {
  const [open, setOpen] = useState<ContactSummary | null>(null);
  const [creating, setCreating] = useState(false);
  const list = useContactList();
  const catalog = useLabelCatalog();
  // Los Campos del cliente: una sola carga para la página (la ficha de cada cliente los usa).
  const fieldCatalog = useContactFieldCatalog();
  // Mientras se reintenta se mantiene el aviso (con el botón ocupado) en vez
  // de saltar a la carga y volver al aviso si falla otra vez.
  const [retrying, setRetrying] = useState(false);
  const retry = async () => {
    setRetrying(true);
    await Promise.all([list.reload(), catalog.refresh()]);
    setRetrying(false);
  };
  const filtering = list.search.trim() !== "" || list.labelId !== null || list.fields.length > 0;

  return (
    <div className="contacts-section">
      <div className="contacts-section__bar">
        <nav className="ui-tabs" aria-label="Secciones">
          <span className="ui-tab" aria-current="page">
            Contactos
          </span>
          {/* Las etiquetas se administran en Configuración: dónde trabaja cada una, unir y borrar sin romper nada. */}
          <Link className="ui-tab" to="/settings/labels">
            Etiquetas{catalog.labels.length > 0 ? ` · ${catalog.labels.length}` : ""} ↗
          </Link>
        </nav>
        <button type="button" className="ui-btn ui-btn--primary" onClick={() => setCreating(true)}>
          Nuevo contacto
        </button>
      </div>

      <section className="ui-panel" aria-label="Contactos">
          <div className="contacts-toolbar">
            <input
              className="ui-input contacts-toolbar__search"
              type="search"
              value={list.search}
              placeholder="Buscar por nombre, teléfono o correo"
              aria-label="Buscar contactos"
              onChange={(e) => list.setSearch(e.target.value)}
            />
            <select
              className="ui-input contacts-toolbar__filter"
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
          <FieldFilterEditor fields={fieldCatalog.fields} value={list.fields} onChange={list.setFields} />

          {list.status === "error" || retrying ? (
            <StateCard
              role="alert"
              tone="warning"
              icon={StateIcons.offline}
              title="No pudimos cargar tus contactos"
              description="Parece un problema de conexión momentáneo. Tus datos están a salvo; vuelve a intentarlo en unos segundos."
              actions={<RetryButton busy={retrying} onRetry={() => void retry()} />}
            />
          ) : list.status === "loading" && list.contacts.length === 0 ? (
            <ContactsTableSkeleton />
          ) : list.contacts.length === 0 && filtering ? (
            <StateCard
              role="status"
              icon={StateIcons.search}
              title="Sin resultados"
              description="Ningún contacto coincide con la búsqueda. Prueba con otro nombre, teléfono, etiqueta o filtro."
              actions={
                <button
                  type="button"
                  className="ui-btn ui-btn--ghost"
                  onClick={() => {
                    list.setSearch("");
                    list.setLabelId(null);
                    list.setFields([]);
                  }}
                >
                  Limpiar filtros
                </button>
              }
            />
          ) : list.contacts.length === 0 ? (
            <StateCard
              icon={StateIcons.people}
              title="Aún no tienes contactos"
              description="Llegarán solos cuando alguien escriba a una de tus conexiones de WhatsApp. También puedes agregarlos a mano."
              actions={
                <button type="button" className="ui-btn ui-btn--primary" onClick={() => setCreating(true)}>
                  Agregar contacto
                </button>
              }
            />
          ) : (
            <ContactsTable contacts={list.contacts} onOpen={setOpen} />
          )}

          {list.page > 1 || list.hasMore ? (
            <div className="contacts-pager">
              <button type="button" className="ui-btn ui-btn--ghost" disabled={list.page <= 1} onClick={() => list.setPage(list.page - 1)}>Anterior</button>
              <span className="ui-muted">Página {list.page}</span>
              <button type="button" className="ui-btn ui-btn--ghost" disabled={!list.hasMore} onClick={() => list.setPage(list.page + 1)}>Siguiente</button>
            </div>
          ) : null}
      </section>

      {open ? (
        <ContactDrawer
          contact={open}
          catalog={catalog.labels}
          fields={fieldCatalog}
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
