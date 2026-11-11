import "./help-admin.css";
import { useState } from "react";
import { PillTabs } from "@shared/ui/pill-tabs/PillTabs";
import { CasesAdmin } from "./CasesAdmin";
import { SupportSettingsForm } from "./SupportSettingsForm";
import { TutorialAdmin } from "./TutorialAdmin";

type Tab = "tutorials" | "cases" | "contact";

/** Solo el equipo de Auream: tutoriales para todas las cuentas, casos de soporte y cómo contactar a soporte. */
export function HelpAdmin({ onNavigate }: { readonly onNavigate: (next: Record<string, string>) => void }) {
  const [tab, setTab] = useState<Tab>("tutorials");
  return (
    <div className="ui-page help-admin">
      <button type="button" className="ui-link" onClick={() => onNavigate({})}>← Centro de ayuda</button>
      <header className="ui-page__header">
        <div>
          <div className="help-admin__title"><h1 className="ui-page__title">Administrar ayuda</h1><span>SOLO EQUIPO AUREAM</span></div>
          <p className="ui-page__subtitle">Lo que publiques aquí lo ven todas las cuentas: en Ayuda, en el panel «?» de cada módulo y dentro de los artículos.</p>
        </div>
      </header>
      <PillTabs label="Administrar" tabs={[{ id: "tutorials", label: "Tutoriales" }, { id: "cases", label: "Casos de soporte" }, { id: "contact", label: "Datos de contacto" }]} selected={tab} onSelect={setTab} />
      {tab === "tutorials" ? <TutorialAdmin /> : null}
      {tab === "cases" ? <CasesAdmin /> : null}
      {tab === "contact" ? <SupportSettingsForm /> : null}
    </div>
  );
}
