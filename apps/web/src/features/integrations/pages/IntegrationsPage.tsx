import "@shared/ui/page/page.css";
import "@shared/ui/controls/controls.css";
import "../components/integrations.css";
import { AiSection } from "../components/AiSection";
import { PixelSection } from "../components/PixelSection";

/**
 * IntegrationsPage — las conexiones de la cuenta con servicios externos. Cada
 * tipo es una sección independiente (sus datos, tarjetas y diálogos); la
 * página solo las ordena.
 */
export function IntegrationsPage() {
  return (
    <div className="ui-page">
      <header className="ui-page__header">
        <div>
          <h1 className="ui-page__title">Integraciones</h1>
          <p className="ui-page__subtitle">Conecta tus cuentas de IA y tus píxeles de Meta. Las claves se guardan cifradas y nunca se muestran completas.</p>
        </div>
      </header>
      <AiSection />
      <PixelSection />
    </div>
  );
}
