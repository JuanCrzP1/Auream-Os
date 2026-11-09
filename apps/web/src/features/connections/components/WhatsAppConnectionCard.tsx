import { useEffect, useRef, useState } from "react";
import type { ConnectionSummary } from "@contracts/ConnectionContracts";
import { formatPhone } from "@shared/phone/formatPhone";
import { formatDate } from "@shared/format/formatDate";
import { BoltGlyph, ChatPhoneGlyph, DotsGlyph, LinkGlyph, OfficialGlyph, QrGlyph } from "./ConnectionGlyphs";
import { METHOD_LABEL, primaryAction, STATUS_HINT, STATUS_LABEL } from "./connectionLabels";

// ---------------------------------------------------------------------------
// Tarjeta de un número: avatar con anillo de estado, número con su bandera,
// método, desde cuándo, sus disparadores y la acción que toca (vincular,
// ver código, reconectar).
// ---------------------------------------------------------------------------

export function WhatsAppConnectionCard({
  connection,
  onLink,
  onTriggers,
  onRename,
  onDelete
}: {
  readonly connection: ConnectionSummary;
  readonly onLink: () => void;
  /** Abrir sus disparadores (qué flujo inicia cada mensaje). */
  readonly onTriggers: () => void;
  readonly onRename: () => void;
  readonly onDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const action = primaryAction(connection.status);
  const phone = connection.phoneNumber ? formatPhone(connection.phoneNumber) : null;

  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [menuOpen]);

  const since =
    connection.status === "connected" && connection.lastConnectedAt
      ? `Conectada desde el ${formatDate(connection.lastConnectedAt)}`
      : `Creada el ${formatDate(connection.createdAt)}`;

  return (
    <article className={`wa-card wa-card--${connection.status}`} aria-label={`${connection.name}, ${STATUS_LABEL[connection.status]}`}>
      <div className="wa-card__top">
        <span className={`wa-avatar wa-avatar--${connection.method}`} aria-hidden="true">
          <ChatPhoneGlyph />
          <span className="wa-avatar__ring" />
        </span>

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

        <div className="wa-card__menu" ref={menuRef}>
          <button
            type="button"
            className="wa-icon-btn"
            aria-label={`Más acciones de ${connection.name}`}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <DotsGlyph />
          </button>
          {menuOpen ? (
            <div className="wa-menu" role="menu">
              <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onRename(); }}>
                Renombrar
              </button>
              {connection.status === "connected" ? (
                <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onLink(); }}>
                  Ver estado
                </button>
              ) : null}
              <button type="button" role="menuitem" className="wa-menu__danger" onClick={() => { setMenuOpen(false); onDelete(); }}>
                Eliminar
              </button>
            </div>
          ) : null}
        </div>
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

      <p className="wa-card__hint">{STATUS_HINT[connection.status]}</p>

      <button
        type="button"
        className={`wa-triggers${connection.triggerCount === 0 ? " wa-triggers--empty" : ""}`}
        onClick={onTriggers}
        aria-label={`Disparadores de ${connection.name}: ${connection.triggerCount === 0 ? "ninguno" : connection.triggerCount}`}
      >
        <BoltGlyph />
        <span className="wa-triggers__text">
          {connection.triggerCount === 0
            ? "Sin disparadores: no inicia ningún flujo"
            : `${connection.triggerCount} ${connection.triggerCount === 1 ? "disparador" : "disparadores"}`}
        </span>
        <span className="wa-triggers__cta" aria-hidden="true">{connection.triggerCount === 0 ? "Configurar" : "Ver"} ›</span>
      </button>

      <footer className="wa-card__footer">
        <span className="wa-card__since">{since}</span>
        {action ? (
          <button type="button" className={`ui-btn ${connection.status === "disconnected" ? "ui-btn--primary" : "ui-btn--ghost"} wa-card__action`} onClick={onLink}>
            <LinkGlyph />
            {action}
          </button>
        ) : null}
      </footer>
    </article>
  );
}
