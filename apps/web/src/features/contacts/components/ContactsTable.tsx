import type { ContactSummary } from "@contracts/ContactContracts";
import { LabelChip } from "./LabelChip";

const MAX_VISIBLE_LABELS = 3;

/** Teléfono legible: `573001234567` → `+573001234567`. */
function formatPhone(phone: string | null): string {
  return phone ? `+${phone}` : "—";
}

/** Tabla de contactos. Cada fila abre la ficha del contacto. */
export function ContactsTable({ contacts, onOpen }: { readonly contacts: ReadonlyArray<ContactSummary>; readonly onOpen: (contact: ContactSummary) => void }) {
  return (
    <div className="contacts-table-wrap">
      <table className="contacts-table">
        <thead>
          <tr>
            <th scope="col">Nombre</th>
            <th scope="col">Teléfono</th>
            <th scope="col" className="contacts-table__email">Correo</th>
            <th scope="col">Etiquetas</th>
          </tr>
        </thead>
        <tbody>
          {contacts.map((contact) => {
            const hidden = contact.labels.length - MAX_VISIBLE_LABELS;
            return (
              <tr key={contact.id}>
                <td>
                  <button type="button" className="contacts-table__open" onClick={() => onOpen(contact)}>
                    {contact.name || "Sin nombre"}
                  </button>
                </td>
                <td className="contacts-table__phone">{formatPhone(contact.phone)}</td>
                <td className="contacts-table__email">{contact.email ?? "—"}</td>
                <td>
                  <div className="contacts-table__labels">
                    {contact.labels.slice(0, MAX_VISIBLE_LABELS).map((label) => (
                      <LabelChip key={label.id} label={label} />
                    ))}
                    {hidden > 0 ? <span className="ui-muted">+{hidden}</span> : null}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
