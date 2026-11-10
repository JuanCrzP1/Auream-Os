import "./invite-link.css";
import { useRef, useState } from "react";
import type { InvitationLinkResponse } from "@contracts/TeamContracts";
import { TEAM_ROLE_INFO } from "@shared/team/teamRoles";
import { invitationUrl } from "../services/teamApi";
import { TeamIcons } from "./teamIcons";

/**
 * El enlace de una invitación recién creada o renovada: copiarlo o mandarlo
 * por WhatsApp. Se muestra UNA vez (el servidor guarda solo su huella), y
 * así se avisa. Cuando exista el correo propio, también llegará solo.
 */
export function InviteLinkPanel({
  titleId,
  link,
  companyName,
  renewed = false,
  onDone
}: {
  readonly titleId: string;
  readonly link: InvitationLinkResponse;
  readonly companyName: string;
  readonly renewed?: boolean;
  readonly onDone: () => void;
}) {
  const field = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);
  const url = invitationUrl(link.token);
  const role = TEAM_ROLE_INFO[link.invitation.role].label;
  const message = `Hola, te invito a unirte a ${companyName} en Auream como ${role}. Entra aquí: ${url}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      // Sin permiso de portapapeles: el enlace queda seleccionado para copiarlo a mano.
      field.current?.select();
    }
  };

  return (
    <div className="invite-link">
      <span className="invite-link__ok" aria-hidden="true">
        {TeamIcons.check}
      </span>
      <h2 id={titleId}>{renewed ? "Enlace nuevo listo" : "Invitación lista"}</h2>
      <p className="ui-muted">
        Para <strong>{link.invitation.email}</strong> como {role}. Mándale este enlace:
      </p>

      <div className="invite-link__field">
        <input ref={field} className="ui-input" readOnly value={url} aria-label="Enlace de la invitación" onFocus={(event) => event.target.select()} />
        <button type="button" className="ui-btn ui-btn--primary" onClick={() => void copy()}>
          {copied ? "¡Copiado!" : "Copiar"}
        </button>
      </div>

      <a className="invite-link__whatsapp" href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer">
        {TeamIcons.chat}
        Enviar por WhatsApp
      </a>

      <p className="invite-link__note">
        Vence en 7 días y solo sirve con ese correo.{renewed ? " El enlace anterior ya no sirve." : ""} Por seguridad no se vuelve a mostrar: si se
        pierde, generas uno nuevo desde la lista.
      </p>

      <div className="ui-dialog__footer">
        <button type="button" className="ui-btn ui-btn--ghost" onClick={onDone}>
          Listo
        </button>
      </div>
    </div>
  );
}
