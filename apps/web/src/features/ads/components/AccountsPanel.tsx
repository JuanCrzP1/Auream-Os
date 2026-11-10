import "./accounts-panel.css";
import { useId } from "react";
import { IntegrationGlyph } from "@shared/ui/integration-kit/IntegrationGlyph";
import { MetaMark } from "@shared/ui/integration-kit/IntegrationMark";
import { AdsIcons } from "./adsIcons";

const PERKS = [
  { title: "El gasto, al día", text: "De cada campaña y anuncio, sin exportar reportes ni subir archivos." },
  { title: "Tú eliges las cuentas", text: "Conectas solo las cuentas publicitarias que quieras ver en Auream." },
  { title: "Ventas por anuncio", text: "Auream cruza el gasto con los chats y las ventas que trajo cada anuncio." }
] as const;

/**
 * Meta Ads → Cuentas: «Conectar con Meta» (inicio de sesión de Meta; ni
 * webhooks ni archivos). Mientras termina la conexión oficial, el botón se ve
 * pero no se puede usar, y dice por qué. Para cuentas de otros negocios, Meta
 * aprueba antes la app.
 */
export function AccountsPanel() {
  const noteId = useId();

  return (
    <section className="ads-accounts" aria-labelledby="ads-accounts-title">
      <div className="ads-accounts__main">
        <MetaMark size="lg" />
        <h2 id="ads-accounts-title" className="ads-accounts__title">
          Conecta tu cuenta de Meta
        </h2>
        <p className="ads-accounts__text">
          Inicias sesión con Meta y eliges qué cuentas publicitarias usa Auream. Nada que descargar ni subir: el gasto se actualiza solo.
        </p>
        <button type="button" className="ads-accounts__meta" disabled aria-describedby={noteId}>
          <IntegrationGlyph kind="meta" mono />
          Conectar con Meta
        </button>
        <p id={noteId} className="ads-accounts__note">
          Estamos terminando la conexión oficial con Meta.
        </p>
      </div>

      <ul className="ads-accounts__perks" aria-label="Lo que obtienes al conectar">
        {PERKS.map((perk) => (
          <li key={perk.title} className="ads-accounts__perk">
            <span className="ads-accounts__check" aria-hidden="true">
              {AdsIcons.check}
            </span>
            <strong>{perk.title}</strong>
            <span className="ads-accounts__perk-text">{perk.text}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
