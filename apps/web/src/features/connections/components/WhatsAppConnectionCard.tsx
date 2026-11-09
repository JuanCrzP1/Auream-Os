import { useEffect, useState } from "react";
import type { ConnectionSummary } from "@contracts/ConnectionContracts";
import { formatPhone } from "@shared/phone/formatPhone";
import { formatDate } from "@shared/format/formatDate";
import { BoltGlyph, ChatPhoneGlyph, LinkGlyph, OfficialGlyph, QrGlyph } from "./ConnectionGlyphs";
import { ConnectionActionsMenu } from "./ConnectionActionsMenu";
import type { ConnectionAction } from "./connectionActions";
import { METHOD_LABEL, primaryAction, STATUS_LABEL } from "./connectionLabels";
import "./connection-card.css";

// ---------------------------------------------------------------------------
// Tarjeta de un número, compacta: foto de perfil (o el ícono) con anillo de
// estado, nombre, número con su bandera, estado y método, sus disparadores y
// la acción que toca. El resto de acciones (reconectar, reiniciar,
// desconectar, renombrar, eliminar) en su menú «⋮», como en Leona.
// ---------------------------------------------------------------------------

function ConnectionAvatar({ connection }: { readonly connection: ConnectionSummary }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
  }, [connection.profilePictureUrl]);
  const photo = connection.profilePictureUrl && !failed ? connection.profilePictureUrl : null;
  return (
    <span className={`wa-avatar wa-avatar--${connection.method}${photo ? " has-photo" : ""}`} aria-hidden="true">
      {photo ? <img src={photo} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} /> : <ChatPhoneGlyph />}
      <span className="wa-avatar__ring" />
    </span>
  );
}

export function WhatsAppConnectionCard({ connection, onAction }: { readonly connection: ConnectionSummary; readonly onAction: (action: ConnectionAction) => void }) {
  const action = primaryAction(connection.status);
  const phone = connection.phoneNumber ? formatPhone(connection.phoneNumber) : null;
  const since =
    connection.status === "connected" && connection.lastConnectedAt
      ? `Conectada desde el ${formatDate(connection.lastConnectedAt)}`
      : connection.status === "disconnected"
        ? `Desconectada · ${formatDate(connection.updatedAt)}`
        : `Creada el ${formatDate(connection.createdAt)}`;

  return (
    <article className={`wa-card wa-card--${connection.status}`} aria-label={`${connection.name}, ${STATUS_LABEL[connection.status]}`}>
      <div className="wa-card__top">
        <ConnectionAvatar connection={connection} />
        <div className="wa-card__identity">
          <h3 className="wa-card__name">{connection.name}</h3>
          {phone ? (
            <p className="wa-card__phone">
              {phone.flag ? <span aria-hidden="true">{phone.flag}</span> : null}
              {phone.text}
            </p>
          ) : (
            <p className="wa-card__phone wa-card__phone--empty">Sin número vinculado</p>
          )}
          {connection.profileName ? <p className="wa-card__profile">{connection.profileName}</p> : null}
        </div>
        <ConnectionActionsMenu name={connection.name} status={connection.status} onAction={onAction} />
      </div>

      <div className="wa-card__status">
        <span className={`wa-pill wa-pill--${connection.status}`}>
          <span className="wa-pill__dot" aria-hidden="true" />
          {STATUS_LABEL[connection.status]}
        </span>
        <span className="wa-method">
          {connection.method === "qr" ? <QrGlyph /> : <OfficialGlyph />}
          {METHOD_LABEL[connection.method]}
        </span>
      </div>

      <button
        type="button"
        className={`wa-triggers${connection.triggerCount === 0 ? " wa-triggers--empty" : ""}`}
        onClick={() => onAction("triggers")}
        aria-label={`Disparadores de ${connection.name}: ${connection.triggerCount === 0 ? "ninguno" : connection.triggerCount}`}
      >
        <BoltGlyph />
        <span className="wa-triggers__text">
          {connection.triggerCount === 0 ? "Sin disparadores" : `${connection.triggerCount} ${connection.triggerCount === 1 ? "disparador" : "disparadores"}`}
        </span>
        <span className="wa-triggers__cta" aria-hidden="true">{connection.triggerCount === 0 ? "Configurar" : "Ver"} ›</span>
      </button>

      <footer className="wa-card__footer">
        <span className="wa-card__since">{since}</span>
        {action ? (
          <button type="button" className={`ui-btn ${connection.status === "disconnected" ? "ui-btn--primary" : "ui-btn--ghost"} wa-card__action`} onClick={() => onAction("link")}>
            <LinkGlyph />
            {action}
          </button>
        ) : null}
      </footer>
    </article>
  );
}
