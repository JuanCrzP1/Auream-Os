import "./business-data.css";
import { useState } from "react";
import type { BusinessDatumSummary } from "@contracts/BusinessDataContracts";
import { useBusinessData } from "@shared/business-data/useBusinessData";
import { RetryButton, StateCard } from "@shared/ui/state/StateCard";
import { StateIcons } from "@shared/ui/state/stateIcons";
import { HowItWorksButton, useHowItWorks } from "@shared/ui/how-it-works/HowItWorks";
import { DatumDrawer } from "./datum/DatumDrawer";
import { DeleteDatumDialog } from "./datum/DeleteDatumDialog";
import { NewDatumDialog } from "./datum/NewDatumDialog";
import { DataTable } from "./list/DataTable";
import { HowBusinessData } from "./list/HowBusinessData";
import { PricesCard } from "./list/PricesCard";
import { useMinute } from "./useMinute";

type Dialog = { readonly kind: "new" } | { readonly kind: "datum"; readonly id: string } | { readonly kind: "delete"; readonly datum: BusinessDatumSummary } | null;

/**
 * Configuración › Datos › Datos del negocio: lo que les dices igual a todos
 * tus clientes (horario, dirección, link de pago, enlace del grupo) escrito
 * una vez y usado como `{g_…}` en flujos, difusiones, respuestas rápidas y el
 * Condicional, con cambios programados e historial. Arriba, «Cómo funciona»
 * (siempre abierto mientras no haya datos). Dueños y administradores los
 * cambian; el resto los ve.
 */
export function BusinessDataSettings() {
  const { data, list, status, reload, create, update, remove, schedules } = useBusinessData();
  const [dialog, setDialog] = useState<Dialog>(null);
  const now = useMinute();
  const how = useHowItWorks("business-data", data !== null && list.length === 0);

  if (!data && status === "loading") return <div className="bd-loading" aria-busy="true" aria-label="Cargando datos del negocio" />;
  if (!data) {
    return status === "forbidden" ? (
      <StateCard icon={StateIcons.lock} title="No tienes acceso a los datos del negocio" description="Pídele acceso a los dueños de la cuenta." />
    ) : (
      <StateCard role="alert" tone="warning" icon={StateIcons.offline} title="No pudimos cargar los datos del negocio" description="Revisa tu conexión e inténtalo de nuevo." actions={<RetryButton busy={false} onRetry={() => void reload()} />} />
    );
  }

  const open = dialog?.kind === "datum" ? list.find((datum) => datum.id === dialog.id) : undefined;

  return (
    <section className="bd" aria-label="Datos del negocio">
      <div className="bd__frame">
        {how.open ? <HowBusinessData {...(how.canClose ? { onClose: how.close } : {})} /> : null}
        <div className="bd__bar">
          <p className="bd__who">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 4 7v6c0 4.4 3.4 7.6 8 8 4.6-.4 8-3.6 8-8V7z" /></svg>
            {data.canManage ? "Tú y los administradores los cambian; tus flujos solo los leen." : "Los cambian los dueños y administradores. Tú los ves y los usas en tus mensajes."}
          </p>
          <div className="bd__actions">
            {how.open ? null : <HowItWorksButton onClick={how.reopen} />}
            {data.canManage ? <button type="button" className="ui-btn ui-btn--primary" onClick={() => setDialog({ kind: "new" })}>Nuevo dato</button> : null}
          </div>
        </div>

        {list.length === 0 ? (
          <StateCard
            icon={StateIcons.sparkles}
            title="Crea tu primer dato"
            description={
              data.canManage
                ? "Empieza por el que más repites: tu horario, tu dirección o tu link de pago."
                : "Aún no hay datos del negocio. Los crean los dueños y administradores de la cuenta."
            }
            actions={data.canManage ? <button type="button" className="ui-btn ui-btn--primary" onClick={() => setDialog({ kind: "new" })}>Crear el primero</button> : undefined}
          />
        ) : (
          <DataTable data={list} timeZone={data.timeZone} now={now} onOpen={(datum) => setDialog({ kind: "datum", id: datum.id })} />
        )}
        <PricesCard />
      </div>

      {/* Los diálogos van fuera del marco medido: la medida atraparía su `position: fixed`. */}
      {dialog?.kind === "new" ? <NewDatumDialog onCreate={create} onClose={() => setDialog(null)} /> : null}
      {open ? (
        <DatumDrawer
          key={open.id}
          datum={open}
          all={list}
          timeZone={data.timeZone}
          now={now}
          canManage={data.canManage}
          onSave={(changes) => update(open.id, changes)}
          schedules={{
            add: (request) => schedules.add(open.id, request),
            change: (scheduleId, request) => schedules.change(open.id, scheduleId, request),
            remove: (scheduleId) => schedules.remove(open.id, scheduleId)
          }}
          onDelete={() => setDialog({ kind: "delete", datum: open })}
          onClose={() => setDialog(null)}
        />
      ) : null}
      {dialog?.kind === "delete" ? <DeleteDatumDialog datum={dialog.datum} onConfirm={(confirm) => remove(dialog.datum.id, confirm)} onClose={() => setDialog(null)} /> : null}
    </section>
  );
}
