import "./data-settings.css";
import { useCallback, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { BusinessDataSettings } from "@features/business-data/BusinessDataSettings";
import { ContactFieldsSettings } from "@features/contact-fields/ContactFieldsSettings";
import { HowItWorksButton, useHowItWorks } from "@shared/ui/how-it-works/HowItWorks";
import { PillTabs } from "@shared/ui/pill-tabs/PillTabs";
import { HowData } from "./HowData";
import { NewDataDialog } from "./NewDataDialog";

export type DataTab = "customer" | "business";

const TABS = [
  { id: "customer", label: "Campos del cliente" },
  { id: "business", label: "Datos del negocio" }
] as const;

const tabOf = (value: string | null): DataTab => (value === "business" ? "business" : "customer");

/**
 * Configuración › Campos y datos: lo que se pone entre llaves en los
 * mensajes, en un solo lugar. Dos pestañas (cada una con sus herramientas:
 * lo que guardan tus flujos y los clientes con dato; cambios programados e
 * historial), un solo «Cómo funciona» que explica la diferencia y un solo
 * «Nuevo dato» que primero pregunta qué clase de dato es. Vive en la capa de
 * la app porque junta dos módulos que no se importan entre sí. La pestaña va
 * en `?tab=` (customer | business).
 */
export function DataSettings() {
  const [params, setParams] = useSearchParams();
  const tab = tabOf(params.get("tab"));
  const how = useHowItWorks("data");
  const [choosing, setChoosing] = useState(false);
  // La pestaña que debe abrir «crear» en cuanto se muestre.
  const [creating, setCreating] = useState<DataTab | null>(null);
  const created = useCallback(() => setCreating(null), []);

  const show = (next: DataTab) => setParams((current) => {
    const updated = new URLSearchParams(current);
    updated.set("tab", next);
    return updated;
  }, { replace: true });

  const choose = (next: DataTab) => {
    setChoosing(false);
    show(next);
    setCreating(next);
  };

  const embed = { onNew: () => setChoosing(true), onCreateOpened: created };

  return (
    <div className="data-settings">
      {how.open ? <HowData onClose={how.close} /> : null}
      <div className="data-settings__bar">
        <PillTabs tabs={TABS} selected={tab} label="Campos y datos" onSelect={show} />
        {how.open ? null : <HowItWorksButton onClick={how.reopen} />}
      </div>
      {tab === "customer" ? (
        <ContactFieldsSettings {...embed} createNow={creating === "customer"} />
      ) : (
        <BusinessDataSettings {...embed} createNow={creating === "business"} />
      )}
      {choosing ? <NewDataDialog current={tab} onChoose={choose} onClose={() => setChoosing(false)} /> : null}
    </div>
  );
}
