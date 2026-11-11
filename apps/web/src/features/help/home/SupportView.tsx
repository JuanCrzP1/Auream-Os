import "./help-home.css";
import { useEffect, useState } from "react";
import type { SupportCase, SupportSettings } from "@contracts/HelpContracts";
import { helpApi } from "@shared/help/helpApi";
import { SupportForm } from "@shared/help/SupportForm";

/** Hablar con soporte a pantalla completa (desde el banner del Centro de ayuda). */
export function SupportView({ onNavigate }: { readonly onNavigate: (next: Record<string, string>) => void }) {
  const [data, setData] = useState<{ settings: SupportSettings | null; cases: ReadonlyArray<SupportCase> }>({ settings: null, cases: [] });
  useEffect(() => {
    void helpApi.support().then(setData).catch(() => undefined);
  }, []);
  return (
    <div className="ui-page help-narrow">
      <button type="button" className="ui-link" onClick={() => onNavigate({})}>← Centro de ayuda</button>
      <header className="ui-page__header"><div><h1 className="ui-page__title">Hablar con soporte</h1><p className="ui-page__subtitle">Una persona del equipo de Auream te responde aquí mismo.</p></div></header>
      <SupportForm settings={data.settings} cases={data.cases} page="/help" onCases={(cases) => setData((current) => ({ ...current, cases }))} />
    </div>
  );
}
