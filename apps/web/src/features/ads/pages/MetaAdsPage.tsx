import "@shared/ui/page/page.css";
import "@shared/ui/controls/controls.css";
import "../components/meta-ads.css";
import { useSearchParams } from "react-router-dom";
import { usePixelConnections } from "@shared/pixel-connections/usePixelConnections";
import { MetaMark } from "@shared/ui/integration-kit/IntegrationMark";
import { AccountsPanel } from "../components/AccountsPanel";
import { AdsNav, adsLabelId, adsPanelId, type AdsNavItem } from "../components/AdsNav";
import { AdsIcons } from "../components/adsIcons";
import { PerformanceSection } from "../components/PerformanceSection";
import { useAdAccounts } from "@shared/ads/useAdAccounts";
import { metaNavStatus } from "../components/metaNavStatus";
import { PixelSection } from "../pixel/PixelSection";
import { pixelNavStatus } from "../pixel/pixelNavStatus";

type Section = "pixel" | "performance" | "accounts";

const SECTIONS: ReadonlyArray<Section> = ["pixel", "performance", "accounts"];

/** Abre en el rendimiento si ya hay cuentas; si no, en Cuentas para conectar. */
const defaultSection = (connected: boolean): Section => (connected ? "performance" : "accounts");

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
  const ads = useAdAccounts();
  const requested = params.get("tab");
  const section: Section = isSection(requested) ? requested : defaultSection(Boolean(ads.data?.connection.connected));
  const open = (next: Section) => setParams({ tab: next }, { replace: true });
  // Al volver del inicio de sesión de Meta: `?meta=connected` o `?meta=error&reason=…`.
  const metaResult = params.get("meta");
  const metaReason = params.get("reason");
  const nav = metaNavStatus(ads.status, ads.data);

  const items: ReadonlyArray<AdsNavItem<Section>> = [
    { id: "pixel", label: "Píxel", icon: AdsIcons.pixel, status: pixelNavStatus(pixels.status, pixels.connections) },
    { id: "performance", label: "Rendimiento", icon: AdsIcons.performance, status: nav.performance },
    { id: "accounts", label: "Cuentas", icon: AdsIcons.accounts, status: nav.accounts }
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

      {metaResult === "connected" ? <p className="meta-ads__banner meta-ads__banner--ok" role="status">Meta quedó conectado. Elige tus cuentas: el gasto de los últimos 2 meses llega en unos minutos.</p> : null}
      {metaResult === "error" ? (
        <p className="meta-ads__banner meta-ads__banner--warn" role="alert">
          {metaReason === "denied" ? "No diste el permiso en Meta. Vuelve a intentarlo cuando quieras." : metaReason === "unavailable" ? "Meta Ads no está disponible en este servidor." : (metaReason ?? "No se pudo conectar con Meta.")}
        </p>
      ) : null}

      <AdsNav items={items} selected={section} onSelect={open} />

      <div className="ui-panel meta-ads__panel" role="tabpanel" id={adsPanelId(section)} aria-labelledby={adsLabelId(section)}>
        {section === "pixel" ? <PixelSection pixels={pixels} /> : null}
        {section === "performance" ? <PerformanceSection onConnectAccount={() => open("accounts")} /> : null}
        {section === "accounts" ? <AccountsPanel ads={ads} /> : null}
      </div>
    </div>
  );
}
