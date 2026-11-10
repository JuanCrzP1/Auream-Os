import "./performance-preview.css";
import type { CSSProperties } from "react";
import { AdsIcons } from "./adsIcons";

const COLUMNS = ["Campaña", "Gasto", "Chats", "Ventas", "ROAS", "Costo por venta"] as const;

/** Largo de cada barra de muestra, en %: solo la forma de la tabla, sin números inventados. */
const ROWS = [
  [72, 58, 40, 46, 38, 62],
  [54, 70, 52, 36, 48, 50],
  [80, 46, 34, 58, 30, 44],
  [62, 64, 46, 42, 52, 56],
  [48, 52, 38, 50, 44, 40]
] as const;

const bar = (width: number) => ({ "--bar": `${width}%` }) as CSSProperties;

/**
 * Meta Ads → Rendimiento, mientras no hay cuenta publicitaria conectada: la
 * forma de la tabla de campañas (gasto, chats, ventas, ROAS y costo por venta)
 * con barras vacías y, encima, cómo conectarla. Nada de números de mentira.
 */
export function PerformancePreview({ onConnectAccount }: { readonly onConnectAccount: () => void }) {
  return (
    <section className="ads-preview" aria-labelledby="ads-preview-title">
      <div className="ads-preview__table" aria-hidden="true">
        <div className="ads-preview__row ads-preview__row--head">
          {COLUMNS.map((column) => (
            <span key={column}>{column}</span>
          ))}
        </div>
        {ROWS.map(([campaign, ...metrics], row) => (
          <div key={row} className="ads-preview__row">
            <span className="ads-preview__campaign">
              <span className="ads-preview__thumb" />
              <span className="ads-preview__bar" style={bar(campaign)} />
            </span>
            {metrics.map((width, cell) => (
              <span key={cell} className="ads-preview__bar" style={bar(width)} />
            ))}
          </div>
        ))}
      </div>

      <div className="ads-preview__card">
        <span className="ads-preview__icon" aria-hidden="true">
          {AdsIcons.performance}
        </span>
        <h2 id="ads-preview-title" className="ads-preview__title">
          Tus campañas, medidas en ventas
        </h2>
        <p className="ads-preview__text">
          Conecta tu cuenta publicitaria y verás cada campaña y anuncio con lo que gastó, los chats que trajo, lo que vendió y su ROAS.
        </p>
        <p className="ads-preview__note">Auream ya guarda de qué anuncio llega cada contacto.</p>
        <button type="button" className="ui-btn ui-btn--primary ads-preview__button" onClick={onConnectAccount}>
          Conectar cuenta
        </button>
      </div>
    </section>
  );
}
