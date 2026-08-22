import "./context-menu.css";
import React, { useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { ContextMenuItem } from "./ContextMenuItem";
import { useClickOutside } from "./useClickOutside";
import { useContextMenuPosition } from "./useContextMenuPosition";

export interface ContextMenuItemDef {
  id: string;
  label: string;
  icon?: string;
  variant?: "default" | "danger";
  disabled?: boolean;
}

interface Props {
  items: ContextMenuItemDef[];
  onSelect: (id: string) => void;
  onClose: () => void;
  triggerRef: React.RefObject<HTMLElement | null>;
}

export function ContextMenu({ items, onSelect, onClose, triggerRef }: Props) {
  const menuRef = useRef<HTMLUListElement | null>(null);

  // Close when clicking outside trigger or menu
  useClickOutside([menuRef, triggerRef], () => onClose());

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const pos = useContextMenuPosition(triggerRef, menuRef);

  if (!pos) {
    // menuRef needs to exist for measurements; render hidden placeholder
    return createPortal(<ul ref={menuRef} style={{ position: "fixed", visibility: "hidden" }} className="ctx-menu" />, document.body);
  }

  return createPortal(
    <ul
      ref={menuRef}
      role="menu"
      className="ctx-menu"
      style={{ position: "fixed", top: pos.top, left: pos.left }}
      aria-label="Menú contextual"
    >
      {items.map((it) => (
        <ContextMenuItem key={it.id} id={it.id} label={it.label} icon={it.icon} variant={it.variant} disabled={it.disabled} onClick={(id) => { onSelect(id); onClose(); }} />
      ))}
    </ul>,
    document.body
  );
}
