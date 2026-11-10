import "@shared/ui/page/page.css";
import "@shared/ui/controls/controls.css";
import "../components/meta-ads.css";
import { useSearchParams } from "react-router-dom";
import { usePixelConnections } from "@shared/pixel-connections/usePixelConnections";
import { MetaMark } from "@shared/ui/integration-kit/IntegrationMark";
import { AccountsPanel } from "../components/AccountsPanel";
import { AdsNav, adsLabelId, adsPanelId, type AdsNavItem } from "../components/AdsNav";
import { AdsIcons } from "../components/adsIcons";
import { PerformancePreview } from "../components/PerformancePreview";
import { PixelSection } from "../pixel/PixelSection";
import { pixelNavStatus } from "../pixel/pixelNavStatus";

type Section = "pixel" | "performance" | "accounts";

const SECTIONS: ReadonlyArray<Section> = ["pixel", "performance", "accounts"];

/** Mientras no estén las campañas (la API de anuncios de Meta), abre en lo que ya funciona: el Píxel. */
const DEFAULT_SECTION: Section = "pixel";

const isSection = (value: string | null): value is Section => SECTIONS.some((section) => section === value);

/**
 * Meta Ads: el Píxel (la API de Conversiones que usa el bloque «Pixel»), el
 * rendimiento de cada campaña y anuncio (gasto, chats, ventas y ROAS) y las
 * cuentas publicitarias («Conectar con Meta»). Las secciones son tarjetas con
 * su estado en vivo y viajan en la dirección (`?tab=pixel`) para poder
 * enlazarlas desde Integraciones y el editor.
 */
export function MetaAdsPage() {
  const [params, setParams] = useSearchParams();
  const pixels = usePixelConnections();
  const requested = params.get("tab");
  const section: Section = isSection(requested) ? requested : DEFAULT_SECTION;
  const open = (next: Section) => setParams({ tab: next }, { replace: true });

  const items: ReadonlyArray<AdsNavItem<Section>> = [
    { id: "pixel", label: "Píxel", icon: AdsIcons.pixel, status: pixelNavStatus(pixels.status, pixels.connections) },
    { id: "performance", label: "Rendimiento", icon: AdsIcons.performance, status: { tone: "idle", text: "Esperando tu cuenta" } },
    { id: "accounts", label: "Cuentas", icon: AdsIcons.accounts, status: { tone: "idle", text: "Sin conectar" } }
  ];

  return (
    <div className="ui-page">
      <header className="ui-page__header">
        <div className="meta-ads__title">
          <MetaMark size="lg" />
          <div>
            <h1 className="ui-page__title">Meta Ads</h1>
            <p className="ui-page__subtitle">Tus anuncios de Facebook e Instagram, medidos en chats y ventas.</p>
          </div>
        </div>
      </header>

      <AdsNav items={items} selected={section} onSelect={open} />

      <div className="ui-panel meta-ads__panel" role="tabpanel" id={adsPanelId(section)} aria-labelledby={adsLabelId(section)}>
        {section === "pixel" ? <PixelSection pixels={pixels} /> : null}
        {section === "performance" ? <PerformancePreview onConnectAccount={() => open("accounts")} /> : null}
        {section === "accounts" ? <AccountsPanel /> : null}
      </div>
    </div>
  );
}
