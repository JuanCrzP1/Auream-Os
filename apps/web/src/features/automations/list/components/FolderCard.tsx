import "./folder-card.css";
import type { AutomationFolderSummary } from "@contracts/AutomationContracts";

interface FolderCardProps {
  folder: AutomationFolderSummary;
  onClick?: (id: string) => void;
}

export function FolderCard({ folder, onClick }: FolderCardProps) {
  const handleClick = () => onClick?.(folder.id);
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") onClick?.(folder.id);
  };

  return (
    <div
      className="hub-folder-card"
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      <span className="hub-folder-card__icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
        </svg>
      </span>
      <span className="hub-folder-card__name">{folder.name}</span>
    </div>
  );
}
