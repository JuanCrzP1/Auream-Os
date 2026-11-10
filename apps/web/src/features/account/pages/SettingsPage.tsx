import "@shared/ui/page/page.css";
import "@shared/ui/controls/controls.css";
import "../components/account-pages.css";
import type { ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { CompanySettings } from "../components/CompanySettings";
import { AppearanceSettings } from "../components/AppearanceSettings";

/** Una pestaña de Configuración. Las de otros módulos (Equipo…) las suma la app (`app/router`). */
export interface SettingsTab {
  readonly id: string;
  readonly label: string;
  readonly content: ReactNode;
}

/**
 * Configuración: los datos de la empresa (logo, nombre y zona horaria, con la
 * que corren los flujos), las pestañas que traen otros módulos (Equipo) y la
 * apariencia de Auream. La pestaña viaja en la dirección (`?tab=team`) para
 * poder enlazarla desde el menú de la cuenta.
 */
export function SettingsPage({ extraTabs = [] }: { readonly extraTabs?: ReadonlyArray<SettingsTab> }) {
  const tabs: ReadonlyArray<SettingsTab> = [
    { id: "company", label: "Empresa", content: <CompanySettings /> },
    ...extraTabs,
    { id: "appearance", label: "Apariencia", content: <AppearanceSettings /> }
  ];
  const [params, setParams] = useSearchParams();
  const current = tabs.find((tab) => tab.id === params.get("tab")) ?? tabs[0]!;

  return (
    <div className="ui-page">
      <header className="ui-page__header">
        <div>
          <h1 className="ui-page__title">Configuración</h1>
          <p className="ui-page__subtitle">Los datos de tu empresa, tu equipo y cómo se ve Auream.</p>
        </div>
      </header>

      <nav className="ui-tabs" role="tablist" aria-label="Secciones">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={tab.id === current.id}
            className="ui-tab"
            onClick={() => setParams({ tab: tab.id }, { replace: true })}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div className="ui-panel">
        <div className="account-page__body">{current.content}</div>
      </div>
    </div>
  );
}
