import "./accounts-panel.css";
import { useId, useState } from "react";
import { IntegrationGlyph } from "@shared/ui/integration-kit/IntegrationGlyph";
import { MetaMark } from "@shared/ui/integration-kit/IntegrationMark";
import { apiErrorMessage } from "@shared/http/apiErrorMessage";
import type { useAdAccounts } from "@shared/ads/useAdAccounts";
import { AdsIcons } from "./adsIcons";
import { MetaAccountsList } from "./MetaAccountsList";
import { MetaTokenDialog } from "./MetaTokenDialog";

const PERKS = [
  { title: "El gasto, al día", text: "De cada campaña y anuncio, cada 3 horas, sin exportar reportes ni subir archivos." },
  { title: "Tú eliges las cuentas", text: "Conectas solo las cuentas publicitarias que quieras ver en Auream." },
  { title: "ROAS real", text: "Auream cruza el gasto con las ventas que trajo cada anuncio, aunque compren días después." }
] as const;

/**
 * Meta Ads → Cuentas. Sin conectar: «Conectar con Meta» (inicio de sesión de
 * Meta) o pegar un token de usuario del sistema; si el servidor no tiene la
 * app de Meta, el token es la acción principal (nunca un botón apagado). Conectado: las cuentas
 * publicitarias para elegir cuáles usa Auream, su última actualización y
 * desconectar. Solo dueños y administradores.
 */
export function AccountsPanel({ ads }: { readonly ads: ReturnType<typeof useAdAccounts> }) {
  const noteId = useId();
  const [tokenOpen, setTokenOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const data = ads.data;

  if (ads.status === "forbidden") {
    return <p className="ads-accounts__locked">Los anuncios y su gasto los ven los dueños y administradores de la cuenta.</p>;
  }
  if (data?.connection.connected) {
    return (
      <>
        <MetaAccountsList ads={ads} onReconnect={() => (data.oauthAvailable ? void ads.startOAuth().catch((e) => setError(apiErrorMessage(e, "No se pudo abrir Meta."))) : setTokenOpen(true))} />
        {error ? <p className="ui-error" role="alert">{error}</p> : null}
        {tokenOpen ? <MetaTokenDialog onConnect={ads.connectToken} onClose={() => setTokenOpen(false)} /> : null}
      </>
    );
  }

  const canManage = data?.canManage ?? false;
  const oauth = data?.oauthAvailable ?? false;
  return (
    <section className="ads-accounts" aria-labelledby="ads-accounts-title">
      <div className="ads-accounts__main">
        <MetaMark size="lg" />
        <h2 id="ads-accounts-title" className="ads-accounts__title">Conecta tu cuenta de Meta</h2>
        <p className="ads-accounts__text">
          {oauth ? "Inicias sesión con Meta y eliges qué cuentas publicitarias usa Auream." : "Pegas el token de tu Business Manager y eliges qué cuentas publicitarias usa Auream."} Nada que descargar ni subir: el gasto
          se actualiza solo.
        </p>
        {oauth ? (
          <button
            type="button"
            className="ads-accounts__meta"
            disabled={!canManage}
            aria-describedby={noteId}
            onClick={() => void ads.startOAuth().catch((e) => setError(apiErrorMessage(e, "No se pudo abrir Meta.")))}
          >
            <IntegrationGlyph kind="meta" mono />
            Conectar con Meta
          </button>
        ) : (
          // Sin el inicio de sesión de Meta (la app aún no está aprobada), el token es la forma de conectar: para todos igual.
          <button type="button" className="ads-accounts__meta" disabled={!canManage} aria-describedby={noteId} onClick={() => setTokenOpen(true)}>
            <IntegrationGlyph kind="meta" mono />
            Conectar con un token
          </button>
        )}
        <p id={noteId} className="ads-accounts__note" hidden={!data}>
          {!data
            ? null
            : !canManage
            ? "Pide a un dueño o administrador que conecte Meta."
            : oauth
              ? "Te pedirá permiso para leer tus anuncios (ads_read)."
              : "Un token de usuario del sistema de tu Business Manager, con el permiso ads_read. No vence y se guarda cifrado."}
        </p>
        {canManage && oauth ? (
          <button type="button" className="ui-link ads-accounts__token" onClick={() => setTokenOpen(true)}>
            ¿Prefieres un token de usuario del sistema? Pégalo aquí
          </button>
        ) : null}
        {error ? <p className="ui-error" role="alert">{error}</p> : null}
      </div>
      <ul className="ads-accounts__perks" aria-label="Lo que obtienes al conectar">
        {PERKS.map((perk) => (
          <li key={perk.title} className="ads-accounts__perk">
            <span className="ads-accounts__check" aria-hidden="true">{AdsIcons.check}</span>
            <strong>{perk.title}</strong>
            <span className="ads-accounts__perk-text">{perk.text}</span>
          </li>
        ))}
      </ul>
      {tokenOpen ? <MetaTokenDialog onConnect={ads.connectToken} onClose={() => setTokenOpen(false)} /> : null}
    </section>
  );
}
