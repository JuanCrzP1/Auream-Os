import "./group-actions-menu.css";
import { useEffect, useRef, useState } from "react";
import type { GroupSummary } from "@contracts/GroupContracts";

export type GroupAction = "copy" | "send" | "detach";

/** Las acciones de un grupo, según lo que se puede hacer con él. */
export function groupActions(group: GroupSummary): ReadonlyArray<{ readonly action: GroupAction; readonly label: string; readonly danger?: true }> {
  return [
    ...(group.inviteLink ? [{ action: "copy" as const, label: "Copiar el enlace de este grupo" }] : []),
    ...(group.isAdmin ? [{ action: "send" as const, label: "Enviar solo a este grupo" }] : []),
    { action: "detach" as const, label: "Sacar de la campaña", danger: true as const }
  ];
}

/** El menú «⋯» de la tarjeta de un grupo. Se cierra con Escape o al hacer clic fuera. */
export function GroupActionsMenu({ group, onAction }: { readonly group: GroupSummary; readonly onAction: (action: GroupAction) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  return (
    <div className="gr-actions" ref={ref}>
      <button type="button" className="gr-actions__toggle" aria-label={`Más acciones de ${group.name}`} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" /></svg>
      </button>
      {open ? (
        <div className="gr-actions__menu" role="menu">
          {groupActions(group).map((item) => (
            <button
              key={item.action}
              type="button"
              role="menuitem"
              className={`gr-actions__item${item.danger ? " gr-actions__item--danger" : ""}`}
              onClick={() => {
                setOpen(false);
                onAction(item.action);
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
