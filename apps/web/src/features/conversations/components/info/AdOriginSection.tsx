import "./ad-origin.css";
import { useEffect, useState } from "react";
import type { ChatAdOrigin } from "@contracts/ChatAdContracts";
import { timeAgo } from "@shared/format/timeAgo";
import { fetchChatAd } from "../../services/chatAdApi";

type State = { readonly kind: "loading" } | { readonly kind: "ready"; readonly ad: ChatAdOrigin | null } | { readonly kind: "error" };

const STATUS: Readonly<Record<string, string>> = { ACTIVE: "Activo", PAUSED: "Pausado", DELETED: "Eliminado", ARCHIVED: "Archivado" };
const DATE = new Intl.DateTimeFormat("es", { day: "numeric", month: "short", year: "numeric" });

/**
 * «Llegó por un anuncio»: el anuncio de Meta que trajo al cliente, con su
 * miniatura, nombre, campaña y estado (si es de tus cuentas conectadas),
 * cuándo llegó, el texto que vio y los enlaces al anuncio y su publicación.
 * Se pide al abrir la info, solo si el chat llegó por un anuncio.
 */
export function AdOriginSection({ conversationId }: { readonly conversationId: string }) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [thumbnailFailed, setThumbnailFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    setState({ kind: "loading" });
    setThumbnailFailed(false);
    fetchChatAd(conversationId)
      .then((response) => alive && setState({ kind: "ready", ad: response.ad }))
      .catch(() => alive && setState({ kind: "error" }));
    return () => {
      alive = false;
    };
  }, [conversationId]);

  if (state.kind === "ready" && !state.ad) return null;

  return (
    <section className="ios-group ad-origin" aria-label="Llegó por un anuncio">
      <h3 className="ad-origin__heading">Llegó por un anuncio</h3>
      {state.kind === "loading" ? <div className="ad-origin__skeleton" aria-busy="true" aria-label="Cargando el anuncio" /> : null}
      {state.kind === "error" ? <p className="ad-origin__note">No se pudo cargar el anuncio.</p> : null}
      {state.kind === "ready" && state.ad ? <AdCard ad={state.ad} thumbnail={thumbnailFailed ? null : state.ad.thumbnailUrl} onThumbnailError={() => setThumbnailFailed(true)} /> : null}
    </section>
  );
}

function AdCard({ ad, thumbnail, onThumbnailError }: { readonly ad: ChatAdOrigin; readonly thumbnail: string | null; readonly onThumbnailError: () => void }) {
  const name = ad.adName ?? ad.title ?? "Anuncio de Meta";
  return (
    <div className="ad-origin__card">
      <div className="ad-origin__top">
        {thumbnail ? (
          <img className="ad-origin__thumb" src={thumbnail} alt="" loading="lazy" referrerPolicy="no-referrer" onError={onThumbnailError} />
        ) : (
          <span className="ad-origin__thumb ad-origin__thumb--empty" aria-hidden="true">📣</span>
        )}
        <div className="ad-origin__info">
          <strong>{name}</strong>
          {ad.campaignName ? <span>Campaña: {ad.campaignName}</span> : null}
          <span className="ad-origin__meta">
            {ad.adStatus ? <span className={`ad-origin__status${ad.adStatus === "ACTIVE" ? " is-active" : ""}`}>{STATUS[ad.adStatus] ?? ad.adStatus}</span> : null}
            {ad.receivedAt ? <span title={DATE.format(new Date(ad.receivedAt))}>Llegó {timeAgo(ad.receivedAt)}</span> : null}
          </span>
        </div>
      </div>
      {ad.adName && ad.title && ad.title !== ad.adName ? <p className="ad-origin__title">«{ad.title}»</p> : null}
      {ad.body ? <p className="ad-origin__body">{ad.body}</p> : null}
      {ad.sourceUrl || ad.mediaUrl ? (
        <div className="ad-origin__links">
          {ad.sourceUrl ? <a href={ad.sourceUrl} target="_blank" rel="noopener noreferrer">Ver anuncio ↗</a> : null}
          {ad.mediaUrl ? <a href={ad.mediaUrl} target="_blank" rel="noopener noreferrer">Ver publicación ↗</a> : null}
        </div>
      ) : null}
      {ad.connected ? null : (
        <p className="ad-origin__note">
          Este anuncio no está en tus cuentas conectadas de Meta Ads, así que no se sabe su campaña ni cuánto costó.
          {ad.sourceId ? ` Id: ${ad.sourceId}.` : ""}
        </p>
      )}
    </div>
  );
}
