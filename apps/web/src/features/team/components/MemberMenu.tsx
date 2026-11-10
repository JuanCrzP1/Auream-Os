import "./member-menu.css";
import { useEffect, useRef, useState } from "react";
import type { TeamRole } from "@contracts/TeamContracts";
import { TEAM_ROLE_INFO } from "@shared/team/teamRoles";

/**
 * El menú ⋯ de un miembro: cambiar su rol (solo los que quien mira puede dar)
 * y quitarlo del equipo. Se cierra con Escape, al tocar fuera o al elegir.
 */
export function MemberMenu({
  name,
  role,
  assignableRoles,
  onChangeRole,
  onRemove
}: {
  readonly name: string;
  readonly role: TeamRole;
  readonly assignableRoles: ReadonlyArray<TeamRole>;
  readonly onChangeRole: (role: TeamRole) => void;
  readonly onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    root.current?.querySelector<HTMLElement>('[role^="menuitem"]')?.focus();
    const outside = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      trigger.current?.focus();
    };
    document.addEventListener("mousedown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  const choose = (action: () => void) => {
    setOpen(false);
    action();
  };

  return (
    <div className="member-menu" ref={root}>
      <button
        ref={trigger}
        type="button"
        className="member-menu__trigger"
        aria-label={`Acciones para ${name}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="5" cy="12" r="1.6" />
          <circle cx="12" cy="12" r="1.6" />
          <circle cx="19" cy="12" r="1.6" />
        </svg>
      </button>
      {open ? (
        <div className="member-menu__panel" role="menu" aria-label={`Acciones para ${name}`}>
          <p className="member-menu__label">Cambiar rol</p>
          {assignableRoles.map((option) => (
            <button
              key={option}
              type="button"
              role="menuitemradio"
              aria-checked={option === role}
              className="member-menu__item"
              onClick={() => choose(() => option !== role && onChangeRole(option))}
            >
              <span className={`member-menu__dot member-menu__dot--${TEAM_ROLE_INFO[option].tone}`} aria-hidden="true" />
              {TEAM_ROLE_INFO[option].label}
              {option === role ? <span className="member-menu__check" aria-hidden="true">✓</span> : null}
            </button>
          ))}
          <div className="member-menu__divider" role="separator" />
          <button type="button" role="menuitem" className="member-menu__item member-menu__item--danger" onClick={() => choose(onRemove)}>
            Quitar del equipo
          </button>
        </div>
      ) : null}
    </div>
  );
}
