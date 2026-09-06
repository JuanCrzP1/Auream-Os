import { useState, useCallback, useRef } from "react";
import { ContextMenu } from "./context-menu/ContextMenu";
import type { AutomationFolderSummary } from "@contracts/AutomationContracts";

/**
 * Acciones de una carpeta.
 *
 * «Personalizar» está declarada y desactivada a propósito: el hueco existe en
 * el menú —igual que «Mover a...» en el de una automatización— para que la
 * capacidad futura tenga sitio, y desactivada para que nadie la pulse
 * esperando algo. No hay color, ni icono, ni backend detrás todavía.
 */
const FOLDER_MENU_ITEMS = [
  { id: "rename", label: "Renombrar", icon: "✎" },
  { id: "customize", label: "Personalizar", icon: "◐", disabled: true }
];

interface FolderContextMenuProps {
  folder: AutomationFolderSummary;
  onRename: (folder: AutomationFolderSummary) => void;
}

/**
 * FolderContextMenu — menú de 3 puntos de una carpeta.
 *
 * Hermano de `AutomationContextMenu` y con su misma responsabilidad: mapear
 * las acciones de este tipo de recurso al `ContextMenu` genérico, que es quien
 * ya sabe cerrarse con Escape y al pulsar fuera. Aquí no hay lógica de negocio
 * ni llamada a ninguna API.
 *
 * PARA EL CLIC QUE ABRE EL MENÚ, `stopPropagation`: la tarjeta entera navega
 * a la carpeta, y sin esto pulsar los tres puntos entraría en ella en vez de
 * desplegar. Es lo mismo que hace la tarjeta de una automatización.
 */
export function FolderContextMenu({ folder, onRename }: FolderContextMenuProps) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement | null>(null);

  const handleButtonClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setOpen((v) => !v);
  }, []);

  const handleSelect = useCallback(
    (itemId: string) => {
      // `customize` no tiene rama: está desactivada y no ejecuta nada.
      if (itemId === "rename") onRename(folder);
    },
    [folder, onRename]
  );

  return (
    <>
      <button
        type="button"
        className="hub-folder-card__menu-btn"
        aria-label={`Acciones para ${folder.name}`}
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
          items={FOLDER_MENU_ITEMS}
          onSelect={handleSelect}
          onClose={() => setOpen(false)}
          triggerRef={btnRef}
        />
      )}
    </>
  );
}
