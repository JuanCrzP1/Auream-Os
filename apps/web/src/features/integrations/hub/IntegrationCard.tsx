import { Link } from "react-router-dom";
import { categoryLabel, connectedLabel, type IntegrationEntry } from "../catalog/integrationCatalog";
import { IntegrationMark } from "../components/ProviderMark";

/** Tarjeta de una integración en el centro: distintivo, categoría, nombre, para qué sirve y su estado. */
export function IntegrationCard({ entry }: { readonly entry: IntegrationEntry }) {
  const active = entry.connected > 0;
  return (
    <article className={`integration-card${active ? " integration-card--active" : ""}`}>
      <div className="integration-card__top">
        <IntegrationMark kind={entry.mark} />
        <span className="integration-card__category">{categoryLabel(entry.category)}</span>
      </div>
      <h3 className="integration-card__name">{entry.name}</h3>
      <p className="integration-card__tagline">{entry.tagline}</p>
      <div className="integration-card__foot">
        {active ? (
          <span className="integration-card__status">
            <span className="integration-card__dot" aria-hidden="true" />
            {connectedLabel(entry)}
          </span>
        ) : (
          <span className="integration-card__status integration-card__status--idle">Sin conectar</span>
        )}
        <Link className="ui-btn ui-btn--ghost integration-card__action" to={`/integrations/${entry.id}`} aria-label={`${active ? "Administrar" : "Configurar"} ${entry.name}`}>
          {active ? "Administrar" : "Configurar"}
        </Link>
      </div>
    </article>
  );
}
