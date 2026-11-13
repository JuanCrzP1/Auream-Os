import "./labels.css";
import { useState } from "react";
import { Link } from "react-router-dom";
import type { LabelOverview } from "@contracts/LabelManagementContracts";
import { useLabelsOverview } from "@shared/labels/useLabelsOverview";
import { RetryButton, StateCard } from "@shared/ui/state/StateCard";
import { StateIcons } from "@shared/ui/state/stateIcons";
import { LabelDrawer } from "./label/LabelDrawer";
import { MoveLabelDialog } from "./label/MoveLabelDialog";
import { NewLabelDialog } from "./label/NewLabelDialog";
import { DuplicatesCard } from "./list/DuplicatesCard";
import { LabelsTable } from "./list/LabelsTable";
import { MergeStatus } from "./list/MergeStatus";

type Dialog =
  | { readonly kind: "new" }
  | { readonly kind: "label"; readonly id: string }
  | { readonly kind: "move"; readonly id: string; readonly mode: "merge" | "delete"; readonly into?: string }
  | null;

/**
 * Configuración › Datos › Etiquetas: cuántos clientes tiene cada una, cuánto
 * vendieron, quién la usa (la etapa de un embudo, flujos, difusiones,
 * webhooks), las repetidas y unir o borrar sin romper nada. Las etapas del
 * CRM también son etiquetas: el embudo se ve en el CRM.
 */
export function LabelsSettings() {
  const { data, status, reload, create, update, merge, remove } = useLabelsOverview();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [skipped, setSkipped] = useState<ReadonlyArray<string>>([]);

  if (!data && status === "loading") return <div className="lb-loading" aria-busy="true" aria-label="Cargando etiquetas" />;
  if (!data) {
    return status === "forbidden" ? (
      <StateCard icon={StateIcons.lock} title="No tienes acceso a las etiquetas" description="Pídele acceso a los dueños de la cuenta." />
    ) : (
      <StateCard role="alert" tone="warning" icon={StateIcons.offline} title="No pudimos cargar las etiquetas" description="Revisa tu conexión e inténtalo de nuevo." actions={<RetryButton busy={false} onRetry={() => void reload()} />} />
    );
  }

  const find = (id: string): LabelOverview | undefined => data.labels.find((label) => label.id === id);
  const open = dialog?.kind === "label" ? find(dialog.id) : undefined;
  const moving = dialog?.kind === "move" ? find(dialog.id) : undefined;
  const reportSkipped = (result: { flowsSkipped?: ReadonlyArray<string> } | null) => setSkipped(result?.flowsSkipped ?? []);

  return (
    <section className="lb" aria-label="Etiquetas">
      <div className="lb__frame">
        <div className="lb__bar">
          <p className="lb__who">
            Las etapas del CRM también son etiquetas: <Link to="/crm">ver el embudo en el CRM</Link>.{" "}
            {data.canManage ? "Tú y los administradores las renombran, unen y borran." : "Las renombran, unen y borran los dueños y administradores."}
          </p>
          {data.canEdit ? <button type="button" className="ui-btn ui-btn--primary" onClick={() => setDialog({ kind: "new" })}>Nueva etiqueta</button> : null}
        </div>

        {skipped.length > 0 ? (
          <p className="ui-error" role="alert">
            {skipped.length === 1 ? `El flujo «${skipped[0]}» no se pudo actualizar` : `Estos flujos no se pudieron actualizar: ${skipped.map((name) => `«${name}»`).join(", ")}`} (alguien lo estaba editando). Ábrelo y cambia la etiqueta a mano.
          </p>
        ) : null}
        <MergeStatus merges={data.merges} />
        <DuplicatesCard
          duplicates={data.duplicates}
          labels={data.labels}
          canManage={data.canManage}
          onMerge={(duplicate) => setDialog({ kind: "move", id: duplicate.otherIds[0]!, mode: "merge", into: duplicate.keepId })}
        />
        {data.labels.length === 0 ? (
          <StateCard
            icon={StateIcons.sparkles}
            title="Aún no hay etiquetas"
            description="Sirven para ordenar a tus clientes (VIP, Pagado, Recompra) y para tus flujos, difusiones y embudos."
            actions={data.canEdit ? <button type="button" className="ui-btn ui-btn--primary" onClick={() => setDialog({ kind: "new" })}>Crear la primera</button> : undefined}
          />
        ) : (
          <LabelsTable labels={data.labels} canSeeSales={data.canSeeSales} onOpen={(label) => setDialog({ kind: "label", id: label.id })} />
        )}
      </div>

      {/* Los diálogos van fuera del marco medido: la medida atraparía su `position: fixed`. */}
      {dialog?.kind === "new" ? <NewLabelDialog onCreate={create} onClose={() => setDialog(null)} /> : null}
      {open ? (
        <LabelDrawer
          key={open.id}
          label={open}
          canEdit={data.canEdit}
          canManage={data.canManage}
          onSave={async (changes) => reportSkipped(await update(open.id, changes))}
          onMerge={() => setDialog({ kind: "move", id: open.id, mode: "merge" })}
          onDelete={() => setDialog({ kind: "move", id: open.id, mode: "delete" })}
          onClose={() => setDialog(null)}
        />
      ) : null}
      {moving && dialog?.kind === "move" ? (
        <MoveLabelDialog
          label={moving}
          labels={data.labels}
          mode={dialog.mode}
          {...(dialog.into ? { initialInto: dialog.into } : {})}
          onMove={async (into) => reportSkipped(await merge({ from: moving.id, into }))}
          onDelete={() => remove(moving.id)}
          onClose={() => setDialog(null)}
        />
      ) : null}
    </section>
  );
}
