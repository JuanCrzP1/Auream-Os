import "./groups-overview.css";
import { useState } from "react";
import { PillTabs } from "@shared/ui/pill-tabs/PillTabs";
import { RetryButton, StateCard } from "@shared/ui/state/StateCard";
import { StateIcons } from "@shared/ui/state/stateIcons";
import { MyGroups } from "../mine/MyGroups";
import { CampaignCard } from "./CampaignCard";
import { FirstGroups } from "./FirstGroups";
import { GroupsHero } from "./GroupsHero";
import { useGroupsOverview } from "./useGroupsOverview";

/** La portada de Grupos: lo vendido este mes, las campañas con su enlace y «Mis grupos». */
export function GroupsOverview({ tab, onTab, onOpen, onNew, onSend }: {
  readonly tab: "campaigns" | "mine";
  readonly onTab: (tab: "campaigns" | "mine") => void;
  readonly onOpen: (id: string) => void;
  readonly onNew: () => void;
  readonly onSend: () => void;
}) {
  const { data, status, refresh } = useGroupsOverview();
  const [retrying, setRetrying] = useState(false);
  const campaigns = data?.campaigns ?? [];
  const empty = data !== null && campaigns.length === 0 && tab === "campaigns";

  return (
    <div className="ui-page gr-page">
      <header className="ui-page__header">
        <div>
          <h1 className="ui-page__title">Grupos y comunidades</h1>
          <p className="ui-page__subtitle">Un solo enlace que llena tus grupos, mensajes a todos a la vez y lo que vende cada grupo.</p>
        </div>
        {data?.canManage && campaigns.length > 0 ? (
          <div className="gr-page__actions">
            <button type="button" className="ui-btn" onClick={onSend}>Enviar a grupos</button>
            <button type="button" className="ui-btn ui-btn--primary" onClick={onNew}>+ Nueva campaña</button>
          </div>
        ) : null}
      </header>

      {status === "loading" ? <p className="ui-muted gr-page__loading" aria-busy="true">Cargando grupos…</p> : null}
      {status === "error" || status === "forbidden" ? (
        <StateCard
          icon={StateIcons.offline}
          tone="warning"
          role="alert"
          title={status === "forbidden" ? "No tienes acceso a Grupos" : "No pudimos cargar tus grupos"}
          description={status === "forbidden" ? "Pídele a un administrador que te dé acceso." : "Revisa tu conexión e inténtalo de nuevo."}
          actions={status === "error" ? <RetryButton busy={retrying} onRetry={() => { setRetrying(true); void refresh().finally(() => setRetrying(false)); }} /> : null}
        />
      ) : null}

      {data && !empty ? <GroupsHero month={data.month} /> : null}
      {data ? (
        <PillTabs label="Ver" tabs={[{ id: "campaigns", label: "Campañas", count: campaigns.length }, { id: "mine", label: "Mis grupos" }]} selected={tab} onSelect={onTab} />
      ) : null}
      {empty ? <FirstGroups canManage={data.canManage} hasNumbers={data.hasNumbers} onNew={onNew} onMine={() => onTab("mine")} /> : null}
      {data && tab === "campaigns" && campaigns.length > 0 ? (
        <section className="gr-cards" aria-label="Campañas">
          {campaigns.map((campaign) => <CampaignCard key={campaign.id} campaign={campaign} onOpen={onOpen} />)}
        </section>
      ) : null}
      {data && tab === "mine" ? <MyGroups campaigns={campaigns} canManage={data.canManage} /> : null}
    </div>
  );
}
