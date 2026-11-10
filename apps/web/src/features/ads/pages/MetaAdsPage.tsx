import "@shared/ui/page/page.css";
import "@shared/ui/controls/controls.css";
import "../components/meta-ads.css";
import { useSearchParams } from "react-router-dom";
import { MetaMark } from "@shared/ui/integration-kit/IntegrationMark";
import { PixelSection } from "../pixel/PixelSection";
import { AccountsTab, CampaignsTab } from "../components/AdsTabs";

type Tab = "campaigns" | "pixel" | "accounts";

const TABS: ReadonlyArray<{ readonly id: Tab; readonly label: string }> = [
  { id: "campaigns", label: "Campañas" },
  { id: "pixel", label: "Píxel" },
  { id: "accounts", label: "Cuentas" }
];

/** Mientras no estén las campañas (conexión con la API de anuncios), abre en lo que ya funciona: el Píxel. */
const DEFAULT_TAB: Tab = "pixel";

const isTab = (value: string | null): value is Tab => TABS.some((tab) => tab.id === value);

/**
 * Meta Ads: todo lo de Meta en un lugar, como en Leona. Campañas (gasto,
 * chats, ventas y ROAS de cada anuncio), Píxel (la API de Conversiones que usa
 * el bloque «Pixel») y Cuentas («Conectar con Meta»). La pestaña viaja en la
 * dirección (`?tab=pixel`) para poder enlazarla desde Integraciones y el editor.
 */
export function MetaAdsPage() {
  const [params, setParams] = useSearchParams();
  const requested = params.get("tab");
  const tab: Tab = isTab(requested) ? requested : DEFAULT_TAB;

  return (
    <div className="ui-page">
      <header className="ui-page__header">
        <div className="meta-ads__title">
          <MetaMark size="lg" />
          <div>
            <h1 className="ui-page__title">Meta Ads</h1>
            <p className="ui-page__subtitle">Tus anuncios de Facebook e Instagram: el Píxel, tus campañas y tus cuentas publicitarias.</p>
          </div>
        </div>
      </header>

      <nav className="ui-tabs" role="tablist" aria-label="Secciones">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className="ui-tab"
            onClick={() => setParams({ tab: item.id }, { replace: true })}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <div className="ui-panel">
        {tab === "pixel" ? <PixelSection /> : null}
        {tab === "campaigns" ? <CampaignsTab /> : null}
        {tab === "accounts" ? <AccountsTab /> : null}
      </div>
    </div>
  );
}
