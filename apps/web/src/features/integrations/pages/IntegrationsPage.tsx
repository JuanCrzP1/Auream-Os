import "@shared/ui/page/page.css";
import "@shared/ui/controls/controls.css";
import "../components/integrations.css";
import { IntegrationsHub } from "../hub/IntegrationsHub";

/**
 * IntegrationsPage — el centro de Integraciones con la cabecera estándar de
 * los módulos. El catálogo y su lógica viven en `hub/` y `catalog/`.
 */
export function IntegrationsPage() {
  return (
    <div className="ui-page">
      <header className="ui-page__header">
        <div>
          <h1 className="ui-page__title">Integraciones</h1>
          <p className="ui-page__subtitle">Conecta Auream con tus servicios de IA, seguimiento y automatización. Las claves se guardan cifradas y nunca se muestran completas.</p>
        </div>
      </header>
      <IntegrationsHub />
    </div>
  );
}
