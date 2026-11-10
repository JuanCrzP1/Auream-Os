import "./account-card.css";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useActiveTenant } from "@shared/auth/tenant/ActiveTenantContext";
import { AccountAvatar } from "./AccountAvatar";
import { AccountMenu } from "./AccountMenu";
import { useAccount } from "./AccountContext";

/**
 * La tarjeta de la cuenta, abajo en la barra lateral (el estándar de las apps
 * con barra lateral): tu foto, tu nombre y la empresa activa. Al tocarla abre
 * el menú de la cuenta hacia arriba. Se cierra al elegir algo, con Escape, al
 * tocar fuera o al cambiar de página.
 */
export function AccountCard() {
  const { profile, company, displayName, email } = useAccount();
  const { state: tenants, activeTenantId } = useActiveTenant();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const { pathname } = useLocation();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!wrap.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) button.current?.focus();
  };

  const tenantName = tenants.status === "ready" ? tenants.tenants.find((tenant) => tenant.tenantId === activeTenantId)?.tenantName : undefined;
  const subtitle = company?.name ?? tenantName ?? email;

  return (
    <div className="account-card" ref={wrap}>
      {open ? <AccountMenu onClose={close} /> : null}
      <button
        ref={button}
        type="button"
        className={`account-card__button${open ? " is-open" : ""}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Cuenta de ${displayName}`}
        onClick={() => setOpen((current) => !current)}
      >
        <AccountAvatar name={displayName || "?"} imageUrl={profile?.photoUrl ?? null} size={36} ring />
        <span className="account-card__text">
          <strong>{displayName}</strong>
          <span>{subtitle}</span>
        </span>
        <svg className="account-card__chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M8 10l4-4 4 4M8 14l4 4 4-4" />
        </svg>
      </button>
    </div>
  );
}
