import "@shared/ui/page/page.css";
import "@shared/ui/controls/controls.css";
import "../components/integrations.css";
import "../hub/integrationsHub.css";
import { Link, useParams } from "react-router-dom";
import { StateCard } from "@shared/ui/state/StateCard";
import { StateIcons } from "@shared/ui/state/stateIcons";
import { categoryLabel } from "../catalog/integrationCatalog";
import { findIntegration } from "../catalog/integrationRegistry";
import { IntegrationMark } from "@shared/ui/integration-kit/IntegrationMark";

/**
 * Página de una integración (`/integrations/<id>`): miga de pan al centro, su
 * encabezado y su panel (donde se conecta y administra). Qué panel va lo
 * decide el registro; esta página no conoce ninguna integración en concreto.
 */
export function IntegrationDetailPage() {
  const { integrationId = "" } = useParams();
  const integration = findIntegration(integrationId);

  if (!integration) {
    return (
      <div className="ui-page">
        <div className="ui-panel">
          <StateCard
            icon={StateIcons.search}
            title="Esta integración no existe"
            description="Puede que el enlace esté mal escrito."
            actions={<Link className="ui-btn ui-btn--primary" to="/integrations">Ver integraciones</Link>}
          />
        </div>
      </div>
    );
  }

  const { definition, Panel } = integration;
  return (
    <div className="ui-page">
      <header className="ui-page__header integration-detail__header">
        <div className="integration-detail__heading">
          <nav className="integration-detail__crumbs" aria-label="Ruta">
            <Link to="/integrations">Integraciones</Link>
            <span aria-hidden="true">›</span>
            <Link to={`/integrations?categoria=${definition.category}`}>{categoryLabel(definition.category)}</Link>
          </nav>
          <div className="integration-detail__title">
            <IntegrationMark kind={definition.mark} size="lg" />
            <div>
              <h1 className="ui-page__title">{definition.name}</h1>
              <p className="ui-page__subtitle">{definition.tagline}</p>
            </div>
          </div>
        </div>
      </header>
      <Panel />
    </div>
  );
}
