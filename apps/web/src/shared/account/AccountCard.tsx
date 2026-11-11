import "./account-card.css";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useActiveTenant } from "@shared/auth/tenant/ActiveTenantContext";
import { AccountAvatar } from "./AccountAvatar";
import { AccountMenu } from "./AccountMenu";
import { NotificationBell } from "./NotificationBell";
import { SupportButton } from "./SupportButton";
import { useAccount } from "./AccountContext";

/** Lo que dura la bajada del menú al cerrarse (igual que en `account-menu.css`). */
const CLOSE_MS = 140;

type Phase = "closed" | "open" | "closing";

const reducedMotion = () => Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);

/**
 * La tarjeta de la cuenta, abajo en la barra lateral (el estándar de las apps
 * con barra lateral): tu foto, tu nombre y la empresa activa; debajo, la
 * campana de notificaciones y la diadema de soporte (solo íconos). Al tocarla
 * abre el menú de la cuenta hacia arriba. Se cierra (bajando) con la flecha
 * junto al nombre, al elegir algo, con Escape o al tocar fuera; al cambiar de página
 * se quita enseguida.
 */
export function AccountCard() {
  const { profile, company, displayName, email } = useAccount();
  const { state: tenants, activeTenantId } = useActiveTenant();
  const [phase, setPhaseState] = useState<Phase>("closed");
  const current = useRef<Phase>("closed");
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const timer = useRef<number | undefined>(undefined);
  const { pathname } = useLocation();
  const open = phase === "open";

  const setPhase = (next: Phase) => {
    current.current = next;
    setPhaseState(next);
  };

  useEffect(() => {
    window.clearTimeout(timer.current);
    setPhase("closed");
  }, [pathname]);

  useEffect(() => {
    return () => {
      window.clearTimeout(timer.current);
    };
  }, []);

  const close = (refocus = true) => {
    if (refocus) button.current?.focus();
    if (current.current !== "open") return;
    window.clearTimeout(timer.current);
    if (reducedMotion()) {
      setPhase("closed");
      return;
    }
    setPhase("closing");
    timer.current = window.setTimeout(() => setPhase("closed"), CLOSE_MS);
  };

  const toggle = () => {
    if (current.current === "open") {
      close(true);
      return;
    }
    window.clearTimeout(timer.current);
    setPhase("open");
  };

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!wrap.current?.contains(event.target as Node)) close(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  const tenantName = tenants.status === "ready" ? tenants.tenants.find((tenant) => tenant.tenantId === activeTenantId)?.tenantName : undefined;
  const subtitle = company?.name ?? tenantName ?? email;

  return (
    <div className="account-card">
      <div className="account-card__main" ref={wrap}>
      {phase !== "closed" ? <AccountMenu onClose={close} closing={phase === "closing"} /> : null}
      <button
        ref={button}
        type="button"
        className={`account-card__button${open ? " is-open" : ""}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Cuenta de ${displayName}`}
        onClick={toggle}
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
      <div className="account-card__actions">
        <NotificationBell />
        <SupportButton />
      </div>
    </div>
  );
}
