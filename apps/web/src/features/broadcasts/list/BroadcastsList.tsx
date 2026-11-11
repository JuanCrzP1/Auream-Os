import "./broadcasts-list.css";
import { useState } from "react";
import type { BroadcastStatus, BroadcastSummary } from "@contracts/BroadcastResultsContracts";
import { PillTabs } from "@shared/ui/pill-tabs/PillTabs";
import { RetryButton, StateCard } from "@shared/ui/state/StateCard";
import { StateIcons } from "@shared/ui/state/stateIcons";
import { BroadcastRow } from "./BroadcastRow";
import { FirstBroadcast } from "./FirstBroadcast";
import { MonthHero } from "./MonthHero";
import { useBroadcasts } from "./useBroadcasts";

type Filter = "all" | "live" | "scheduled" | "paused" | "finished";
const GROUPS: Readonly<Record<Exclude<Filter, "all">, ReadonlyArray<BroadcastStatus>>> = {
  live: ["sending", "testing"],
  scheduled: ["scheduled"],
  paused: ["paused", "auto_paused"],
  finished: ["done", "cancelled"]
};
const LABELS: Readonly<Record<Filter, string>> = { all: "Todas", live: "En curso", scheduled: "Programadas", paused: "Pausadas", finished: "Terminadas" };

/** La portada de Difusiones: lo que vendieron este mes y cada difusión con su resultado. */
export function BroadcastsList({ onNew, onOpen }: { readonly onNew: () => void; readonly onOpen: (id: string) => void }) {
  const { data, status, refresh } = useBroadcasts();
  const [filter, setFilter] = useState<Filter>("all");
  const [retrying, setRetrying] = useState(false);
  const list = data?.broadcasts ?? [];
  const inGroup = (key: Filter, broadcast: BroadcastSummary) => key === "all" || GROUPS[key].includes(broadcast.status);
  const shown = list.filter((broadcast) => inGroup(filter, broadcast));
  const autoPaused = data?.month.autoPaused ?? 0;

  return (
    <div className="ui-page bc-list">
      <header className="ui-page__header">
        <div>
          <h1 className="ui-page__title">Difusiones</h1>
          <p className="ui-page__subtitle">Un flujo o un mensaje a muchos clientes a la vez, sin poner en riesgo tu número.</p>
        </div>
        {data?.canManage && list.length > 0 ? (
          <button type="button" className="ui-btn ui-btn--primary" onClick={onNew}>
            + Nueva difusión
          </button>
        ) : null}
      </header>

      {status === "loading" ? <div className="bc-list__loading" aria-busy="true">Cargando difusiones…</div> : null}
      {status === "error" || status === "forbidden" ? (
        <StateCard
          icon={StateIcons.offline}
          tone="warning"
          role="alert"
          title={status === "forbidden" ? "No tienes acceso a Difusiones" : "No pudimos cargar las difusiones"}
          description={status === "forbidden" ? "Pídele a un administrador que te dé acceso." : "Revisa tu conexión e inténtalo de nuevo."}
          actions={status === "error" ? <RetryButton busy={retrying} onRetry={() => { setRetrying(true); void refresh().finally(() => setRetrying(false)); }} /> : null}
        />
      ) : null}

      {data && list.length === 0 ? <FirstBroadcast canManage={data.canManage} onNew={onNew} /> : null}
      {data && list.length > 0 ? (
        <>
          <MonthHero month={data.month} />
          <div className="bc-list__bar">
            <PillTabs
              label="Filtrar difusiones"
              tabs={(Object.keys(LABELS) as Filter[]).map((key) => ({ id: key, label: LABELS[key], ...(key === "all" ? {} : { count: list.filter((b) => inGroup(key, b)).length, alert: key === "paused" }) }))}
              selected={filter}
              onSelect={setFilter}
            />
            <span className={`bc-list__shield${autoPaused > 0 ? " bc-list__shield--warn" : ""}`}>
              {autoPaused > 0 ? `${autoPaused} se pausó sola para cuidar tu número: revísala` : "Envío seguro: pausas al azar, horario y tope por número"}
            </span>
          </div>
          <section className="bc-list__rows" aria-label="Difusiones">
            {shown.map((broadcast) => (
              <BroadcastRow key={broadcast.id} broadcast={broadcast} onOpen={onOpen} />
            ))}
            {shown.length === 0 ? <p className="ui-muted bc-list__none">No hay difusiones aquí.</p> : null}
          </section>
        </>
      ) : null}
    </div>
  );
}
