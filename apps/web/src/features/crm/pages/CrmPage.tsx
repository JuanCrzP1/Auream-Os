import "@shared/ui/page/page.css";
import "@shared/ui/controls/controls.css";
import "./crm-page.css";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useProductCatalog } from "@shared/products/useProductCatalog";
import { PillTabs } from "@shared/ui/pill-tabs/PillTabs";
import { StateCard } from "@shared/ui/state/StateCard";
import { StateIcons } from "@shared/ui/state/stateIcons";
import { ContactsSection } from "../contacts/components/ContactsSection";
import { DealDrawer } from "../deal/DealDrawer";
import { FollowUpsTab } from "../follow-ups/FollowUpsTab";
import { CrmHeaderActions } from "../pipeline/CrmHeaderActions";
import { CrmDialogs, type CrmDialog } from "../pipeline/CrmDialogs";
import { PipelineEmpty } from "../pipeline/PipelineEmpty";
import { PipelineTab } from "../pipeline/PipelineTab";
import { usePipelines } from "../pipeline/usePipelines";
import { crmApi } from "../services/crmApi";

type Tab = "pipeline" | "contacts" | "follow-ups";
const TABS: ReadonlyArray<Tab> = ["pipeline", "contacts", "follow-ups"];
const isTab = (value: string | null): value is Tab => TABS.some((tab) => tab === value);

/**
 * CRM: el embudo de ventas (tablero o lista, con su valor y sus números), los
 * contactos con sus etiquetas y los seguimientos. Cada etapa es una etiqueta:
 * los flujos mueven clientes con el bloque Etiquetas. La pestaña y el embudo
 * viajan en la dirección (`?tab=follow-ups`, `?pipeline=…`).
 */
export function CrmPage() {
  const [params, setParams] = useSearchParams();
  const tab: Tab = isTab(params.get("tab")) ? (params.get("tab") as Tab) : "pipeline";
  const pipes = usePipelines();
  const catalog = useProductCatalog();
  const pipeline = pipes.pipelines.find((candidate) => candidate.id === params.get("pipeline")) ?? pipes.pipelines[0] ?? null;
  const [refreshKey, setRefreshKey] = useState(0);
  const [overdue, setOverdue] = useState(0);
  const [openContact, setOpenContact] = useState<string | null>(null);
  const [dialog, setDialog] = useState<CrmDialog>(null);
  const refresh = () => setRefreshKey((key) => key + 1);

  // Los vencidos de quien mira, abra la pestaña que abra (la insignia de «Seguimientos»).
  useEffect(() => {
    let alive = true;
    crmApi.followUps("overdue", "me").then((response) => alive && setOverdue(response.counts.overdue)).catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [refreshKey]);

  const setParam = (key: string, value: string | null) =>
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (value === null) next.delete(key);
      else next.set(key, value);
      return next;
    }, { replace: true });

  return (
    <div className="ui-page crm-page">
      <header className="ui-page__header">
        <div>
          <h1 className="ui-page__title">CRM</h1>
          <p className="ui-page__subtitle">En qué etapa va cada cliente, cuánto vale y qué seguimiento le toca.</p>
        </div>
        {tab === "pipeline" && pipeline ? (
          <CrmHeaderActions
            pipelines={pipes.pipelines}
            selected={pipeline}
            canWrite={pipes.canWrite}
            canManage={pipes.canManage}
            onSelect={(id) => setParams({ pipeline: id }, { replace: true })}
            onConfigure={() => setDialog({ kind: "settings", pipeline })}
            onNewPipeline={() => setDialog({ kind: "settings", pipeline: null })}
            onAddClient={() => setDialog({ kind: "add", pipeline })}
          />
        ) : null}
      </header>

      <div className="ui-panel crm-page__panel">
        <PillTabs
          label="Secciones del CRM"
          tabs={[
            { id: "pipeline", label: "Embudo" },
            { id: "contacts", label: "Contactos" },
            { id: "follow-ups", label: "Seguimientos", ...(overdue > 0 ? { count: overdue, alert: true } : {}) }
          ]}
          selected={tab}
          onSelect={(next) => setParam("tab", next === "pipeline" ? null : next)}
        />
        <div role="tabpanel" aria-label={tab === "contacts" ? "Contactos" : tab === "follow-ups" ? "Seguimientos" : "Embudo"}>
          {tab === "contacts" ? (
            <ContactsSection />
          ) : tab === "follow-ups" ? (
            <FollowUpsTab canWrite={pipes.canWrite} refreshKey={refreshKey} onOpenContact={setOpenContact} onChanged={refresh} />
          ) : pipes.status === "loading" ? (
            <div className="crm-page__loading" aria-busy="true" aria-label="Cargando el CRM" />
          ) : pipes.status === "forbidden" ? (
            <StateCard icon={StateIcons.lock} title="Sin acceso al CRM" description="Tu rol en esta cuenta no permite ver el embudo. Pídeselo a un administrador." />
          ) : pipes.status !== "ready" ? (
            <StateCard role="alert" tone="warning" icon={StateIcons.offline} title="No pudimos cargar el CRM" description="Vuelve a intentarlo en unos segundos." />
          ) : pipeline ? (
            <PipelineTab key={pipeline.id} pipeline={pipeline} canWrite={pipes.canWrite} refreshKey={refreshKey} onOpen={setOpenContact} onChanged={refresh} />
          ) : (
            <PipelineEmpty canManage={pipes.canManage} onCreate={pipes.createStarter} />
          )}
        </div>
      </div>

      {openContact ? (
        <DealDrawer
          contactId={openContact}
          pipelines={pipes.pipelines}
          members={pipes.members}
          products={catalog.products}
          canWrite={pipes.canWrite}
          onChanged={refresh}
          onClose={() => setOpenContact(null)}
        />
      ) : null}
      <CrmDialogs
        dialog={dialog}
        products={catalog.products}
        onSave={pipes.save}
        onRemove={pipes.remove}
        onSaved={(id) => {
          if (id) setParams({ pipeline: id }, { replace: true });
          refresh();
        }}
        onClose={() => setDialog(null)}
      />
    </div>
  );
}
