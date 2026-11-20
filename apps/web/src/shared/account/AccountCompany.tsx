import "./account-company.css";
import { useId, useRef, useState, type KeyboardEvent } from "react";
import { AccountMenuIcons } from "@app/navigation/account/account-menu-items";
import { roleLabel } from "@shared/team/teamRoles";
import { AccountAvatar } from "./AccountAvatar";

export interface CompanyMembership {
  readonly tenantId: string;
  readonly tenantName: string;
  readonly role: string;
}

/**
 * La empresa activa en el menú de la cuenta: su logo, su nombre y tu rol.
 * Sirve SOLO para cambiar de empresa (la configuración es su propia opción):
 *  · con una sola empresa, solo la muestra (no se toca);
 *  · con varias, tocarla despliega la lista, con la actual marcada; Escape
 *    recoge la lista sin cerrar el menú.
 */
export function AccountCompany({ name, logoUrl, memberships, activeTenantId, onSwitch }: {
  readonly name: string;
  readonly logoUrl: string | null;
  readonly memberships: ReadonlyArray<CompanyMembership>;
  readonly activeTenantId: string | null;
  readonly onSwitch: (tenantId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  const listId = useId();
  const active = memberships.find((tenant) => tenant.tenantId === activeTenantId) ?? null;
  const role = active ? roleLabel(active.role) : "Empresa";

  const identity = (
    <>
      <AccountAvatar name={name} imageUrl={logoUrl} size={28} shape="square" />
      <span className="account-menu__who">
        <strong>{name}</strong>
        <span>{role}</span>
      </span>
    </>
  );

  if (memberships.length < 2) return <div className="account-company">{identity}</div>;

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Escape" || !open) return;
    event.preventDefault();
    event.stopPropagation();
    setOpen(false);
    toggle.current?.focus();
  };

  return (
    <div onKeyDown={onKeyDown}>
      <button
        ref={toggle}
        type="button"
        role="menuitem"
        className="account-company account-company--switch"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={`${name}, ${role}. Cambiar de empresa`}
        onClick={() => setOpen((current) => !current)}
      >
        {identity}
        <span className="account-company__switch" aria-hidden="true">{AccountMenuIcons.switch}</span>
      </button>
      {open ? (
        <div id={listId} className="account-company__list" role="group" aria-label="Cambiar de empresa">
          {memberships.map((tenant) => {
            const current = tenant.tenantId === activeTenantId;
            return (
              <button
                key={tenant.tenantId}
                type="button"
                role="menuitemradio"
                aria-checked={current}
                className="account-menu__item"
                onClick={() => (current ? setOpen(false) : onSwitch(tenant.tenantId))}
              >
                <AccountAvatar name={tenant.tenantName} imageUrl={null} size={22} shape="square" />
                <span className="account-menu__label">{tenant.tenantName}</span>
                {current ? <span className="account-company__check" aria-hidden="true">{AccountMenuIcons.check}</span> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
