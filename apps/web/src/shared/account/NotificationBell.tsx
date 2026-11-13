import "./sidebar-actions.css";
import "./notice-list.css";
import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { AppNotification, NotificationKind } from "@contracts/NotificationContracts";
import { formatRelative } from "@shared/notifications/formatRelative";
import { useNotificationFeed } from "@shared/notifications/useNotificationFeed";
import { SidebarPopover } from "./SidebarPopover";

const TONE: Record<NotificationKind, string> = {
  number_disconnected: "rose",
  broadcast_auto_paused: "amber",
  sales_review: "amber",
  follow_ups_due: "primary",
  group_created: "teal",
  flow_failures: "rose"
};

/** La campana debajo de la cuenta (solo ícono, con su nombre al pasar el mouse): lo que pide atención, con el número de lo nuevo. Cada aviso lleva a donde se resuelve. */
export function NotificationBell() {
  const button = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const { feed, failed, refresh, markSeen } = useNotificationFeed();
  const unread = feed?.unread ?? 0;

  const toggle = () => {
    if (open) return setOpen(false);
    setOpen(true);
    void refresh().then(markSeen);
  };

  return (
    <>
      <button ref={button} type="button" className={`sidebar-action${open ? " is-open" : ""}`} aria-label={unread > 0 ? `Notificaciones, ${unread} nuevas` : "Notificaciones"} title="Notificaciones" aria-expanded={open} onClick={toggle}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 16.5V11a6 6 0 1 1 12 0v5.5l1.5 1.5h-15z" /><path d="M10 20.5a2.2 2.2 0 0 0 4 0" /></svg>
        {unread > 0 ? <span className="sidebar-action__badge">{unread > 9 ? "9+" : unread}</span> : null}
      </button>
      {open ? (
        <SidebarPopover anchor={button} label="Notificaciones" onClose={() => setOpen(false)}>
          <header className="sidebar-popover__head"><span><strong>Notificaciones</strong><small>Lo que pide tu atención ahora</small></span></header>
          <div className="sidebar-popover__body">
            {feed === null && !failed ? <span className="notice-list__loading" aria-label="Cargando" /> : null}
            {feed === null && failed ? (
              <div className="notice-list__empty">
                <strong>No pudimos cargar los avisos</strong>
                <small>Revisa tu conexión.</small>
                <button type="button" className="ui-btn" onClick={() => void refresh()}>Reintentar</button>
              </div>
            ) : null}
            {feed && feed.items.length === 0 ? (
              <div className="notice-list__empty">
                <span aria-hidden="true">✓</span>
                <strong>Todo en orden</strong>
                <small>Te avisamos aquí si un número se desconecta, una difusión se pausa, hay ventas por revisar o seguimientos para hoy.</small>
              </div>
            ) : null}
            {feed?.items.map((item) => <NoticeRow key={item.id} item={item} onOpen={() => setOpen(false)} />)}
          </div>
        </SidebarPopover>
      ) : null}
    </>
  );
}

function NoticeRow({ item, onOpen }: { readonly item: AppNotification; readonly onOpen: () => void }) {
  return (
    <Link className={`notice-row${item.unread ? " is-unread" : ""}`} to={item.path} onClick={onOpen}>
      <span className={`notice-row__dot notice-row__dot--${TONE[item.kind]}`} aria-hidden="true" />
      <span className="notice-row__text">
        <strong>{item.title}</strong>
        <span>{item.detail}</span>
        <small>{formatRelative(item.occurredAt)}</small>
      </span>
      {item.unread ? <span className="notice-row__new">Nuevo</span> : null}
    </Link>
  );
}
