import { useState } from "react";
import { escribirFlujoArrastrado } from "../services/flowDragPayload";
import "./hub-card.css";
import "./hub-card-flow.css";
import { useNavigate } from "react-router-dom";
import type { AutomationSummary } from "@contracts/AutomationContracts";
import { AutomationContextMenu } from "./AutomationContextMenu";
import { HubCardFlowTrail } from "./HubCardFlowTrail";
import { ToolsLayersIcon } from "@features/automations/shared/ToolsLayersIcon";

interface AutomationFlowCardProps {
  flow: AutomationSummary;
  onDelete?: (flow: AutomationSummary) => void;
  onRename?: (flow: AutomationSummary) => void;
}

export function AutomationFlowCard({ flow, onDelete, onRename }: AutomationFlowCardProps) {
  const navigate = useNavigate();

  const handleClick = (e: React.MouseEvent) => {
    // No navegar si el clic viene del botón del menú
    // Ignorar clicks que vengan del trigger del menú O del propio menú
    if (
      (e.target as HTMLElement).closest(".hub-card__menu-btn") ||
      (e.target as HTMLElement).closest(".ctx-menu")
    ) return;
    navigate(`/builder/${flow.key}`);
  };

  // Lo único que este componente guarda: si ahora mismo se la están llevando.
  // Muere con la tarjeta y no viaja a ningún sitio.
  const [arrastrando, setArrastrando] = useState(false);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") navigate(`/builder/${flow.key}`);
  };

  // El resumen del grafo lo calcula el servidor y llega en la respuesta. Si no
  // llega —una API anterior a estos campos— se omite entero en vez de pintar un
  // contador sin número y un punto sin color que, además, se anunciaría como
  // «desconectada»: ausente y desconectada no son lo mismo, y afirmar lo
  // segundo cuando ocurre lo primero es mentir sobre el flujo.
  const hayResumen =
    typeof flow.nodeCount === "number" &&
    (flow.connectionStatus === "connected" || flow.connectionStatus === "disconnected");

  return (
    <article
      className={`hub-card${arrastrando ? " hub-card--dragging" : ""}`}
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      // La tarjeta solo ANUNCIA que se la llevan y quién es. Qué
      // significa soltarla es asunto del destino; a dónde va, del hub.
      draggable
      onDragStart={(event) => {
        escribirFlujoArrastrado(event.dataTransfer, flow.id);
        setArrastrando(true);
      }}
      onDragEnd={() => setArrastrando(false)}
    >
      <HubCardFlowTrail />
      {/* El nombre ocupa la fila entera. Antes compartía sitio con un
          distintivo que decía «Borrador» en todas: se guardan solas, así
          que no informaba de nada y le quitaba ancho al nombre. */}
      <div className="hub-card__header">
        <span className="hub-card__name">{flow.name}</span>
      </div>
      {flow.tags && flow.tags.length > 0 && (
        <div className="hub-card__tags">
          {flow.tags.map((tag) => (
            <span key={tag} className="hub-card__tag">{tag}</span>
          ))}
        </div>
      )}
      <footer className="hub-card__footer">
        <div className="hub-card__footer-meta">
          <time dateTime={flow.updatedAt} className="hub-card__date">
            {new Date(flow.updatedAt).toLocaleDateString("es-ES")}
          </time>
          {hayResumen && (
            <>
              <span className="hub-card__separator" aria-hidden="true">·</span>
              <span className="hub-card__node-count" aria-label={`${flow.nodeCount} nodos`}>
                <span className="hub-card__tools-icon" aria-hidden="true"><ToolsLayersIcon /></span>
                {flow.nodeCount}
              </span>
              <span
                className={`hub-card__connection-status hub-card__connection-status--${flow.connectionStatus}`}
                aria-label={flow.connectionStatus === "connected" ? "Estructura conectada" : "Estructura desconectada"}
              />
            </>
          )}
        </div>
        <AutomationContextMenu
          flow={flow}
          onOpen={(f) => navigate(`/builder/${f.key}`)}
          onRename={onRename}
          onDelete={onDelete}
        />
      </footer>
    </article>
  );
}
