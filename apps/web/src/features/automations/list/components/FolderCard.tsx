import { useState } from "react";
import "./folder-card.css";
import type { AutomationFolderSummary } from "@contracts/AutomationContracts";
import { arrastraUnFlujo, leerFlujoArrastrado } from "../services/flowDragPayload";
import { FolderContextMenu } from "./FolderContextMenu";

interface FolderCardProps {
  folder: AutomationFolderSummary;
  onClick?: (id: string) => void;
  /**
   * Un flujo se ha soltado encima.
   *
   * La carpeta no sabe qué significa mover: avisa de quién ha caído dentro y
   * quien coordina el hub decide qué hacer con ello.
   */
  onDropFlow?: (flowId: string, folderId: string) => void;
  /** Cuántas automatizaciones contiene. Lo cuenta el hub, no esta tarjeta. */
  flowCount?: number;
  /** Se ha pedido renombrarla desde su menú. Quién lo hace es del hub. */
  onRename?: (folder: AutomationFolderSummary) => void;
}

export function FolderCard({ folder, onClick, onDropFlow, onRename, flowCount = 0 }: FolderCardProps) {
  // Si ahora mismo hay un flujo encima. Estado de un gesto, nada más: muere
  // con él y no viaja a ninguna parte.
  const [recibiendo, setRecibiendo] = useState(false);

  const handleClick = () => onClick?.(folder.id);
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") onClick?.(folder.id);
  };

  return (
    <div
      className={`hub-folder-card${recibiendo ? " hub-folder-card--receiving" : ""}`}
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onDragOver={(event) => {
        // Solo un flujo enciende la carpeta. Un archivo del escritorio, un
        // enlace o una selección de texto pasan de largo: sin
        // `preventDefault` el navegador no permite soltarlos aquí.
        if (!arrastraUnFlujo(event.dataTransfer)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        setRecibiendo(true);
      }}
      onDragLeave={() => setRecibiendo(false)}
      onDrop={(event) => {
        const flowId = leerFlujoArrastrado(event.dataTransfer);
        setRecibiendo(false);
        if (!flowId) return;

        event.preventDefault();
        onDropFlow?.(flowId, folder.id);
      }}
    >
      <span className="hub-folder-card__icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
        </svg>
      </span>
      <span className="hub-folder-card__meta">
        <span className="hub-folder-card__name">{folder.name}</span>
        {/* Sin navegación por carpetas todavía, este recuento es la única
            prueba visible de que el flujo llegó a su destino. */}
        <span className="hub-folder-card__count">
          {flowCount === 1 ? "1 automatización" : `${flowCount} automatizaciones`}
        </span>
      </span>
      {/* Las acciones van al final de la fila, como en la tarjeta de una
          automatización. El menú se encarga de que pulsarlo no abra la
          carpeta. */}
      {onRename && <FolderContextMenu folder={folder} onRename={onRename} />}
    </div>
  );
}
