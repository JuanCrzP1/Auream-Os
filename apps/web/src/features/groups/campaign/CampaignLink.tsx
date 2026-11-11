import "./campaign-link.css";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import type { CampaignSummary } from "@contracts/GroupContracts";
import { count } from "../groupsFormat";

/** El enlace único con su QR (para imprimir o historias), copiar, y a qué grupo lleva ahora. */
export function CampaignLink({ campaign }: { readonly campaign: CampaignSummary }) {
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(campaign.link, { margin: 1, width: 360, color: { dark: "#1e1530", light: "#ffffff" } })
      .then((url) => !cancelled && setQr(url))
      .catch(() => !cancelled && setQr(null));
    return () => {
      cancelled = true;
    };
  }, [campaign.link]);

  const copy = async () => {
    await navigator.clipboard?.writeText(campaign.link).catch(() => undefined);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="gr-link" aria-label="Enlace único">
      {qr ? (
        <a className="gr-link__qr" href={qr} download={`qr-${campaign.slug}.png`} title="Descargar el QR">
          <img src={qr} alt={`Código QR de ${campaign.link}`} />
        </a>
      ) : null}
      <div className="gr-link__main">
        <span className="gr-link__label">Un solo enlace para anuncios, bio e historias</span>
        <div className="gr-link__row">
          <strong className="gr-link__url">{campaign.link.replace(/^https?:\/\//, "")}</strong>
          <button type="button" className="gr-link__copy" onClick={() => void copy()}>{copied ? "✓ Copiado" : "Copiar"}</button>
        </div>
        <span className="ui-muted gr-link__hint">
          Lleva al grupo que tiene cupo. Cuando uno llega a <strong>{count(campaign.capacity)}</strong> miembros, Auream crea el siguiente con el mismo nombre, foto, descripción y reglas. Nunca cambias el enlace.
          Para saber de dónde llegan, agrega <code>?src=instagram</code> al final.
        </span>
      </div>
      <div className="gr-link__now">
        <span className="ui-muted">Ahora lleva a</span>
        <strong>{campaign.current ? campaign.current.name : campaign.status === "active" ? "Creando el grupo…" : "Nadie (apagado)"}</strong>
        {campaign.current ? <span className="gr-link__free">{count(campaign.current.free)} cupos libres</span> : null}
      </div>
    </section>
  );
}
