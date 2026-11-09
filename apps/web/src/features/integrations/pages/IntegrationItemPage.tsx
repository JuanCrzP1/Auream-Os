import "@shared/ui/page/page.css";
import "@shared/ui/controls/controls.css";
import "../components/integrations.css";
import "../hub/integrationsHub.css";
import { Link, useParams } from "react-router-dom";
import { StateCard } from "@shared/ui/state/StateCard";
import { StateIcons } from "@shared/ui/state/stateIcons";
import { findIntegration } from "../catalog/integrationRegistry";

/**
 * Página de un elemento de una integración (`/integrations/<id>/<elemento>`),
 * p. ej. el editor de un webhook. La pone el módulo (`ItemPage` en el
 * registro); esta página solo la busca.
 */
export function IntegrationItemPage() {
  const { integrationId = "", itemId = "" } = useParams();
  const ItemPage = findIntegration(integrationId)?.ItemPage;
  if (!ItemPage) {
    return (
      <div className="ui-page">
        <div className="ui-panel">
          <StateCard icon={StateIcons.search} title="Esta página no existe" description="Puede que el enlace esté mal escrito." actions={<Link className="ui-btn ui-btn--primary" to="/integrations">Ver integraciones</Link>} />
        </div>
      </div>
    );
  }
  return <ItemPage itemId={itemId} />;
}
