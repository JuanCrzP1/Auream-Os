import "./invite-results.css";
import { useState } from "react";
import type { InvitationLinkResponse } from "@contracts/TeamContracts";
import { TEAM_ROLE_INFO } from "@shared/team/teamRoles";
import { invitationUrl } from "../services/teamApi";
import { TeamIcons } from "./teamIcons";

export interface InviteOutcome {
  readonly email: string;
  readonly link?: InvitationLinkResponse;
  readonly error?: string;
}

/**
 * El resultado de invitar a varios: cada correo con su enlace (copiar o
 * WhatsApp) o el motivo por el que no se pudo. Los enlaces se muestran una sola vez.
 */
export function InviteResults({ titleId, outcomes, companyName, onDone }: { readonly titleId: string; readonly outcomes: ReadonlyArray<InviteOutcome>; readonly companyName: string; readonly onDone: () => void }) {
  const [copied, setCopied] = useState<string | null>(null);
  const done = outcomes.filter((outcome) => outcome.link).length;

  const copy = async (email: string, url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(email);
    } catch {
      setCopied(null);
    }
  };

  return (
    <div className="invite-results">
      <h2 id={titleId}>{done === outcomes.length ? "Invitaciones listas" : `${done} de ${outcomes.length} invitaciones listas`}</h2>
      <p className="ui-muted">Manda a cada persona su enlace. Vencen en 7 días y cada uno solo sirve con su correo. No se vuelven a mostrar.</p>
      <ul className="invite-results__list">
        {outcomes.map(({ email, link, error }) => {
          if (!link) {
            return (
              <li key={email} className="invite-results__item invite-results__item--error">
                <span className="invite-results__email">{email}</span>
                <span className="invite-results__error">{error}</span>
              </li>
            );
          }
          const url = invitationUrl(link.token);
          const role = TEAM_ROLE_INFO[link.invitation.role].label;
          const message = `Hola, te invito a unirte a ${companyName} en Auream como ${role}. Entra aquí: ${url}`;
          return (
            <li key={email} className="invite-results__item">
              <span className="invite-results__email">{email}</span>
              <span className="invite-results__actions">
                <button type="button" className="ui-btn ui-btn--ghost invite-results__btn" onClick={() => void copy(email, url)}>
                  {copied === email ? "¡Copiado!" : "Copiar enlace"}
                </button>
                <a className="invite-results__whatsapp" href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer" aria-label={`Enviar por WhatsApp a ${email}`}>
                  {TeamIcons.chat}
                </a>
              </span>
            </li>
          );
        })}
      </ul>
      <div className="ui-dialog__footer">
        <button type="button" className="ui-btn ui-btn--ghost" onClick={onDone}>
          Listo
        </button>
      </div>
    </div>
  );
}
