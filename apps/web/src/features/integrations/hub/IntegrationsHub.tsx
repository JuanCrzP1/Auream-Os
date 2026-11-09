import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { RetryButton, StateCard } from "@shared/ui/state/StateCard";
import { StateIcons } from "@shared/ui/state/stateIcons";
import { INTEGRATION_CATEGORIES, filterEntries, splitByActivity, type CategoryFilter, type IntegrationEntry } from "../catalog/integrationCatalog";
import { useIntegrationCatalog } from "../catalog/useIntegrationCatalog";
import { IntegrationCard } from "./IntegrationCard";
import "./integrationsHub.css";

const CATEGORY_IDS = new Set<string>(INTEGRATION_CATEGORIES.map((category) => category.id));

function readCategory(value: string | null): CategoryFilter {
  return value && CATEGORY_IDS.has(value) ? (value as CategoryFilter) : "all";
}

function Group({ title, hint, entries }: { readonly title: string; readonly hint: string; readonly entries: ReadonlyArray<IntegrationEntry> }) {
  if (entries.length === 0) return null;
  const id = `integrations-${title.toLowerCase()}`;
  return (
    <section className="integrations-hub__group" aria-labelledby={id}>
      <header className="integrations-hub__group-head">
        <h2 id={id}>
          {title} <span className="integrations-hub__count">{entries.length}</span>
        </h2>
        <p>{hint}</p>
      </header>
      <div className="integrations-hub__grid">
        {entries.map((entry) => (
          <IntegrationCard key={entry.id} entry={entry} />
        ))}
      </div>
    </section>
  );
}

/**
 * Centro de Integraciones: el catálogo por categorías, con buscador, lo
 * conectado arriba («Activas») y lo demás debajo («Disponibles»). Cada
 * tarjeta lleva a la página de su integración (`/integrations/<id>`).
 */
export function IntegrationsHub() {
  const [params, setParams] = useSearchParams();
  const category = readCategory(params.get("categoria"));
  const [query, setQuery] = useState("");
  const [retrying, setRetrying] = useState(false);
  const catalog = useIntegrationCatalog();
  const visible = filterEntries(catalog.entries, category, query);
  const { active, available } = splitByActivity(visible);

  const selectCategory = (next: CategoryFilter) => {
    const updated = new URLSearchParams(params);
    if (next === "all") updated.delete("categoria");
    else updated.set("categoria", next);
    setParams(updated, { replace: true });
  };

  const retry = async () => {
    setRetrying(true);
    await catalog.refresh();
    setRetrying(false);
  };

  return (
    <>
      <nav className="ui-tabs integrations-hub__tabs" role="tablist" aria-label="Categorías">
        {[{ id: "all" as const, label: "Todas" }, ...INTEGRATION_CATEGORIES].map((option) => (
          <button key={option.id} type="button" role="tab" className="ui-tab" aria-selected={category === option.id} onClick={() => selectCategory(option.id)}>
            {option.label}
          </button>
        ))}
      </nav>

      <div className="ui-panel integrations-hub">
        <label className="integrations-hub__search">
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <circle cx="9" cy="9" r="6" fill="none" stroke="currentColor" strokeWidth="1.8" />
            <path d="m13.5 13.5 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          <input className="ui-input" type="search" value={query} placeholder="Buscar integración…" aria-label="Buscar integración" onChange={(event) => setQuery(event.target.value)} />
        </label>

        {catalog.status === "error" || retrying ? (
          <StateCard
            role="alert"
            tone="warning"
            icon={StateIcons.offline}
            title="No pudimos cargar tus integraciones"
            description="Parece un problema de conexión momentáneo. Vuelve a intentarlo en unos segundos."
            actions={<RetryButton busy={retrying} onRetry={() => void retry()} />}
          />
        ) : catalog.status === "loading" ? (
          <div className="integrations-hub__grid" aria-busy="true" aria-label="Cargando integraciones">
            <div className="integration-card integration-card--skeleton" />
            <div className="integration-card integration-card--skeleton" />
            <div className="integration-card integration-card--skeleton" />
          </div>
        ) : visible.length === 0 ? (
          <StateCard icon={StateIcons.search} title="Ninguna integración coincide" description="Prueba con otro nombre o elige «Todas»." />
        ) : (
          <>
            <Group title="Activas" hint="Conectadas en tu cuenta" entries={active} />
            <Group title="Disponibles" hint="Listas para conectar" entries={available} />
          </>
        )}
      </div>
    </>
  );
}
