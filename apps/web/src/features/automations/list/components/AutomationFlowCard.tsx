import "./hub-card.css";
import { useNavigate } from "react-router-dom";
import type { AutomationSummary } from "@contracts/AutomationContracts";
import { AutomationContextMenu } from "./AutomationContextMenu";

const STATUS_LABELS: Record<string, string> = {
  active: "Activo",
  paused: "Pausado",
  draft: "Borrador",
  archived: "Archivado"
};

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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") navigate(`/builder/${flow.key}`);
  };

  return (
    <article
      className="hub-card"
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      <div className="hub-card__header">
        <span className="hub-card__name">{flow.name}</span>
        <span className={`hub-card__status hub-card__status--${flow.status}`}>
          {STATUS_LABELS[flow.status] ?? flow.status}
        </span>
      </div>
      {flow.tags && flow.tags.length > 0 && (
        <div className="hub-card__tags">
          {flow.tags.map((tag) => (
            <span key={tag} className="hub-card__tag">{tag}</span>
          ))}
        </div>
      )}
      <footer className="hub-card__footer">
        <time dateTime={flow.updatedAt} className="hub-card__date">
          {new Date(flow.updatedAt).toLocaleDateString("es-ES")}
        </time>
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
