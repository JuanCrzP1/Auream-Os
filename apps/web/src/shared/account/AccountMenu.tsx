import "./account-menu.css";
import { useEffect, useRef, type KeyboardEvent } from "react";
import { Link } from "react-router-dom";
import { useActiveTenant } from "@shared/auth/tenant/ActiveTenantContext";
import { useSignOut } from "@shared/auth/hooks/useSignOut";
import { AccountMenuIcons, accountHelpLink, accountMenuLinks, type AccountMenuLink } from "@app/navigation/account/account-menu-items";
import { AccountAvatar } from "./AccountAvatar";
import { useAccount } from "./AccountContext";
import { ThemeSwitch } from "./ThemeSwitch";

const ROLE_LABEL: Readonly<Record<string, string>> = {
  platform_admin: "Administrador de la plataforma",
  tenant_owner: "Dueño",
  tenant_admin: "Administrador",
  operator: "Asesor",
  viewer: "Solo lectura"
};

const FOCUSABLE = '[role="menuitem"], [role="menuitemradio"]';
const SETTINGS_PATH = "/settings";

function MenuLink({ link, onNavigate }: { readonly link: AccountMenuLink; readonly onNavigate: () => void }) {
  return (
    <Link role="menuitem" to={link.path} className="account-menu__item" title={link.hint} onClick={onNavigate}>
      <span className="account-menu__icon" aria-hidden="true">{link.icon}</span>
      <span className="account-menu__label">{link.label}</span>
      {link.soon ? <span className="account-menu__soon">Pronto</span> : null}
    </Link>
  );
}

/**
 * El menú de la cuenta (se abre desde la tarjeta de abajo en la barra lateral,
 * con su mismo ancho): quién eres, en qué empresa estás (su tarjeta abre sus
 * datos; con varias, cambiar de empresa), tu perfil, la configuración y lo que
 * llega pronto, el tema, la ayuda y cerrar sesión. Con teclado: flechas,
 * Inicio/Fin y Escape.
 */
export function AccountMenu({ onClose }: { readonly onClose: (refocus?: boolean) => void }) {
  const { profile, company, displayName, email } = useAccount();
  const { state: tenants, activeTenantId, selectTenant } = useActiveTenant();
  const signOut = useSignOut();
  const menu = useRef<HTMLDivElement>(null);

  useEffect(() => {
    menu.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
  }, []);

  const memberships = tenants.status === "ready" ? tenants.tenants : [];
  const active = memberships.find((tenant) => tenant.tenantId === activeTenantId) ?? null;
  const others = memberships.filter((tenant) => tenant.tenantId !== activeTenantId);
  const companyName = company?.name ?? active?.tenantName ?? "";

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose(true);
      return;
    }
    const items = [...(menu.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])];
    const index = items.indexOf(document.activeElement as HTMLElement);
    const go = (next: number) => {
      event.preventDefault();
      items[(next + items.length) % items.length]?.focus();
    };
    if (event.key === "ArrowDown") go(index + 1);
    else if (event.key === "ArrowUp") go(index - 1);
    else if (event.key === "Home") go(0);
    else if (event.key === "End") go(items.length - 1);
  };

  const switchTo = (tenantId: string) => {
    selectTenant(tenantId);
    // Todo lo que se ve es de la empresa: se recarga limpio con la nueva.
    window.location.assign("/automations");
  };

  return (
    <div className="account-menu" role="menu" aria-label="Menú de la cuenta" ref={menu} onKeyDown={onKeyDown}>
      <div className="account-menu__identity">
        <AccountAvatar name={displayName} imageUrl={profile?.photoUrl ?? null} size={36} />
        <span className="account-menu__who">
          <strong>{displayName}</strong>
          <span>{email}</span>
        </span>
      </div>

      {companyName ? (
        <Link role="menuitem" to={SETTINGS_PATH} className="account-menu__company" title="Datos de la empresa" onClick={() => onClose(false)}>
          <AccountAvatar name={companyName} imageUrl={company?.logoUrl ?? null} size={28} shape="square" />
          <span className="account-menu__who">
            <strong>{companyName}</strong>
            <span>{active ? ROLE_LABEL[active.role] ?? active.role : "Empresa"}</span>
          </span>
          <span className="account-menu__chevron" aria-hidden="true">{AccountMenuIcons.chevron}</span>
        </Link>
      ) : null}
      {others.length > 0 ? (
        <div className="account-menu__group" aria-label="Cambiar de empresa">
          {others.map((tenant) => (
            <button key={tenant.tenantId} type="button" role="menuitem" className="account-menu__item" onClick={() => switchTo(tenant.tenantId)}>
              <AccountAvatar name={tenant.tenantName} imageUrl={null} size={22} shape="square" />
              <span className="account-menu__label">Cambiar a {tenant.tenantName}</span>
            </button>
          ))}
        </div>
      ) : null}

      <div className="account-menu__group">
        {accountMenuLinks.map((link) => (
          <MenuLink key={link.path} link={link} onNavigate={() => onClose(false)} />
        ))}
      </div>

      <div className="account-menu__group">
        <ThemeSwitch />
        <MenuLink link={accountHelpLink} onNavigate={() => onClose(false)} />
      </div>

      <div className="account-menu__group">
        <button type="button" role="menuitem" className="account-menu__item account-menu__item--danger" onClick={() => void signOut()}>
          <span className="account-menu__icon" aria-hidden="true">{AccountMenuIcons.signOut}</span>
          <span className="account-menu__label">Cerrar sesión</span>
        </button>
      </div>
    </div>
  );
}
