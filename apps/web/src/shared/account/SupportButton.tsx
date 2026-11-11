import "./sidebar-actions.css";
import "./support-pop.css";
import "./notice-list.css";
import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import type { SupportSettings } from "@contracts/HelpContracts";
import { helpApi } from "@shared/help/helpApi";
import { whatsappLink } from "@shared/help/moduleForPath";
import { SidebarPopover } from "./SidebarPopover";

/** La diadema debajo de la cuenta (solo ícono, con su nombre al pasar el mouse): cómo hablar con el equipo de Auream (lo configura el equipo en «Administrar ayuda»). */
export function SupportButton() {
  const button = useRef<HTMLButtonElement>(null);
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState<SupportSettings | null>(null);

  useEffect(() => {
    if (!open || settings) return;
    void helpApi.support().then((data) => setSettings(data.settings)).catch(() => setSettings({ whatsapp: null, email: null, hours: null, responseTime: null }));
  }, [open, settings]);

  const ready = Boolean(settings?.whatsapp || settings?.email);
  const promise = [settings?.responseTime ? `Respondemos en ${settings.responseTime}` : null, settings?.hours].filter(Boolean).join(" · ");

  return (
    <>
      <button ref={button} type="button" className={`sidebar-action${open ? " is-open" : ""}`} aria-label="Soporte" title="Soporte" aria-expanded={open} onClick={() => setOpen(!open)}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 14v-2a8 8 0 0 1 16 0v2" /><rect x="3" y="13" width="4" height="6" rx="1.6" /><rect x="17" y="13" width="4" height="6" rx="1.6" /><path d="M19 19c0 1.4-1.6 2.5-4 2.5h-2" /></svg>
      </button>
      {open ? (
        <SidebarPopover anchor={button} label="Soporte" onClose={() => setOpen(false)}>
          <header className="support-pop__head">
            <span className="support-pop__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="M4 14v-2a8 8 0 0 1 16 0v2" /><rect x="3" y="13" width="4" height="6" rx="1.6" /><rect x="17" y="13" width="4" height="6" rx="1.6" /><path d="M19 19c0 1.4-1.6 2.5-4 2.5h-2" /></svg>
            </span>
            <strong>¿Necesitas ayuda?</strong>
            <small>{ready ? `Habla con el equipo de Auream.${promise ? ` ${promise}.` : ""}` : "Estamos configurando los canales de soporte. Mientras tanto, el Centro de ayuda tiene la guía de cada módulo."}</small>
          </header>
          <div className="support-pop__actions">
            {settings === null ? <span className="notice-list__loading" aria-label="Cargando" /> : null}
            {settings?.whatsapp ? (
              <a className="support-pop__whatsapp" href={whatsappLink(settings.whatsapp, pathname)} target="_blank" rel="noreferrer">
                <span><strong>Escribir por WhatsApp</strong><small>Lo más rápido</small></span><span aria-hidden="true">→</span>
              </a>
            ) : null}
            {settings?.email ? (
              <a className="support-pop__option" href={`mailto:${settings.email}`}>
                <span><strong>Correo</strong><small>{settings.email}</small></span><span aria-hidden="true">→</span>
              </a>
            ) : null}
            <Link className="support-pop__option" to="/help" onClick={() => setOpen(false)}>
              <span><strong>Centro de ayuda</strong><small>Guías paso a paso y videos</small></span><span aria-hidden="true">→</span>
            </Link>
          </div>
        </SidebarPopover>
      ) : null}
    </>
  );
}
