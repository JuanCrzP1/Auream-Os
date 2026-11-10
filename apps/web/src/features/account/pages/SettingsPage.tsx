import "@shared/ui/page/page.css";
import "@shared/ui/controls/controls.css";
import "../components/account-pages.css";
import { useState } from "react";
import { CompanySettings } from "../components/CompanySettings";
import { AppearanceSettings } from "../components/AppearanceSettings";

type Tab = "company" | "appearance";

/**
 * Configuración: los datos de la empresa (logo, nombre y zona horaria, con la
 * que corren los flujos) y la apariencia de Auream. Cada módulo que traiga
 * ajustes propios suma aquí su pestaña.
 */
export function SettingsPage() {
  const [tab, setTab] = useState<Tab>("company");

  return (
    <div className="ui-page">
      <header className="ui-page__header">
        <div>
          <h1 className="ui-page__title">Configuración</h1>
          <p className="ui-page__subtitle">Los datos de tu empresa y cómo se ve Auream.</p>
        </div>
      </header>

      <nav className="ui-tabs" role="tablist" aria-label="Secciones">
        <button type="button" role="tab" aria-selected={tab === "company"} className="ui-tab" onClick={() => setTab("company")}>
          Empresa
        </button>
        <button type="button" role="tab" aria-selected={tab === "appearance"} className="ui-tab" onClick={() => setTab("appearance")}>
          Apariencia
        </button>
      </nav>

      <div className="ui-panel">
        <div className="account-page__body">{tab === "company" ? <CompanySettings /> : <AppearanceSettings />}</div>
      </div>
    </div>
  );
}
