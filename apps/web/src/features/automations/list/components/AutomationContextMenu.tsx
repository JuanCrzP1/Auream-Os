import "./hub-card.css";
import { useState, useCallback, useRef } from "react";
import { ContextMenu } from "./context-menu/ContextMenu";
import type { AutomationSummary } from "@contracts/AutomationContracts";
import type { ContextMenuItemDef } from "./context-menu/ContextMenu";

/** Una archivada ofrece «Restaurar» en lugar de «Archivar». */
function menuItems(archived: boolean): ContextMenuItemDef[] {
  return [
    { id: "open", label: "Abrir", icon: "↗" },
    { id: "rename", label: "Renombrar", icon: "✎" },
    { id: "duplicate", label: "Duplicar", icon: "⊕" },
    { id: "move", label: "Mover a…", icon: "→" },
    archived
      ? { id: "restore", label: "Restaurar", icon: "↺" }
      : { id: "archive", label: "Archivar", icon: "⊟" },
    { id: "delete", label: "Eliminar", icon: "✕", variant: "danger" }
  ];
}

interface AutomationContextMenuProps {
  flow: AutomationSummary;
  onOpen: (flow: AutomationSummary) => void;
  onRename?: (flow: AutomationSummary) => void;
  onDuplicate?: (flow: AutomationSummary) => void;
  onMove?: (flow: AutomationSummary) => void;
  onArchive?: (flow: AutomationSummary) => void;
  onRestore?: (flow: AutomationSummary) => void;
  onDelete?: (flow: AutomationSummary) => void;
}

/**
 * AutomationContextMenu — menú de 3 puntos de un flow.
 *
 * Responsabilidad única: mapear acciones del dominio (open, rename, …)
 * al ContextMenu genérico. No contiene lógica de negocio.
 */
export function AutomationContextMenu({
  flow,
  onOpen,
  onRename,
  onDuplicate,
  onMove,
  onArchive,
  onRestore,
  onDelete
}: AutomationContextMenuProps) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement | null>(null);

  const handleButtonClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setOpen((v) => !v);
  }, []);

  const handleSelect = useCallback((itemId: string) => {
    switch (itemId) {
      case "open":      onOpen(flow);             break;
      case "rename":    onRename?.(flow);         break;
      case "duplicate": onDuplicate?.(flow);      break;
      case "move":      onMove?.(flow);           break;
      case "archive":   onArchive?.(flow);        break;
      case "restore":   onRestore?.(flow);        break;
      case "delete":    onDelete?.(flow);         break;
    }
  }, [flow, onOpen, onRename, onDuplicate, onMove, onArchive, onRestore, onDelete]);

  return (
    <>
      <button
        type="button"
        className="hub-card__menu-btn"
        aria-label={`Acciones para ${flow.name}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={handleButtonClick}
        ref={btnRef}
      >
        <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <circle cx="10" cy="4" r="1.5" />
          <circle cx="10" cy="10" r="1.5" />
          <circle cx="10" cy="16" r="1.5" />
        </svg>
      </button>

      {open && (
        <ContextMenu
          items={menuItems(flow.status === "archived")}
          onSelect={handleSelect}
          onClose={() => setOpen(false)}
          triggerRef={btnRef}
        />
      )}
    </>
  );
}
