import "./list/fields-list.css";
import { useState } from "react";
import type { ContactFieldSummary } from "@contracts/ContactFieldContracts";
import { RetryButton, StateCard } from "@shared/ui/state/StateCard";
import { StateIcons } from "@shared/ui/state/stateIcons";
import { DiscoveryView } from "./discovery/DiscoveryView";
import { DeleteFieldDialog } from "./field/DeleteFieldDialog";
import { FieldDrawer } from "./field/FieldDrawer";
import { NewFieldDialog } from "@shared/contact-fields/NewFieldDialog";
import { useContactFieldCatalog } from "@shared/contact-fields/useContactFieldCatalog";
import { FieldsTable } from "./list/FieldsTable";
import { PendingCard } from "./list/PendingCard";
import { SystemFields } from "./list/SystemFields";

type Dialog = { readonly kind: "new" } | { readonly kind: "field"; readonly id: string } | { readonly kind: "delete"; readonly field: ContactFieldSummary } | null;

/**
 * Configuración › Datos › Campos del cliente: los datos que la cuenta guarda
 * de cada cliente, con su tipo, en cuántos clientes están y qué bloques los
 * llenan o los leen. El primer día propone convertir en campos lo que los
 * flujos ya guardan. Dueños y administradores los organizan; el resto los ve.
 */
export function ContactFieldsSettings() {
  const { data, status, reload, create, adopt, update, remove } = useContactFieldCatalog();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [reviewing, setReviewing] = useState<boolean | null>(null);

  if (!data && status === "loading") return <div className="cf-loading" aria-busy="true" aria-label="Cargando campos del cliente" />;
  if (!data) {
    return (
      <StateCard role="alert" tone="warning" icon={StateIcons.offline} title="No pudimos cargar los campos del cliente" description="Revisa tu conexión e inténtalo de nuevo." actions={<RetryButton busy={false} onRetry={() => void reload()} />} />
    );
  }

  const firstDay = data.fields.length === 0 && data.undefinedKeys > 0 && data.canManage;
  const showDiscovery = reviewing ?? firstDay;
  const open = dialog?.kind === "field" ? data.fields.find((field) => field.id === dialog.id) : undefined;

  return (
    <section className="cf" aria-label="Campos del cliente">
      <div className="cf__frame">
        <div className="cf__bar">
          <p className="cf__who">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 4 7v6c0 4.4 3.4 7.6 8 8 4.6-.4 8-3.6 8-8V7z" /></svg>
            {data.canManage ? "Tú y los administradores los editan; tu equipo los ve y los llena en la ficha del cliente." : "Los editan los dueños y administradores. Tú los ves y los llenas en la ficha del cliente."}
          </p>
          {data.canManage && !showDiscovery ? <button type="button" className="ui-btn ui-btn--primary" onClick={() => setDialog({ kind: "new" })}>Nuevo campo</button> : null}
        </div>

        {showDiscovery ? (
          <DiscoveryView total={data.totalContacts} onAdopt={adopt} onClose={() => setReviewing(false)} />
        ) : (
          <>
            {data.canManage && data.undefinedKeys > 0 ? <PendingCard pending={data.undefinedKeys} onReview={() => setReviewing(true)} /> : null}
            {data.fields.length === 0 ? (
              <StateCard
                icon={StateIcons.sparkles}
                title="Ponle nombre y tipo a lo que sabes de tus clientes"
                description={data.canManage ? "Ciudad, presupuesto, cumpleaños… Un campo se llena desde tus flujos o en la ficha, y lo usas en mensajes y condiciones." : "Aún no hay campos. Los crean los dueños y administradores de la cuenta."}
                actions={data.canManage ? <button type="button" className="ui-btn ui-btn--primary" onClick={() => setDialog({ kind: "new" })}>Crear el primero</button> : undefined}
              />
            ) : (
              <FieldsTable fields={data.fields} total={data.totalContacts} onOpen={(field) => setDialog({ kind: "field", id: field.id })} />
            )}
          </>
        )}
        <SystemFields fields={data.system} />
      </div>

      {/* Los diálogos van fuera del marco medido: la medida atraparía su `position: fixed`. */}
      {dialog?.kind === "new" ? <NewFieldDialog onCreate={create} onClose={() => setDialog(null)} /> : null}
      {open ? (
        <FieldDrawer
          field={open}
          total={data.totalContacts}
          canManage={data.canManage}
          onSave={(changes) => update(open.id, changes)}
          onDelete={() => setDialog({ kind: "delete", field: open })}
          onClose={() => setDialog(null)}
        />
      ) : null}
      {dialog?.kind === "delete" ? <DeleteFieldDialog field={dialog.field} onConfirm={(confirm) => remove(dialog.field.id, confirm)} onClose={() => setDialog(null)} /> : null}
    </section>
  );
}
