
interface Props {
  id: string;
  label: string;
  icon?: string;
  variant?: "default" | "danger";
  disabled?: boolean;
  onClick: (id: string) => void;
}

export function ContextMenuItem({ id, label, icon, variant, disabled, onClick }: Props) {
  return (
    <li role="none">
      <button
        type="button"
        role="menuitem"
        disabled={disabled}
        className={`ctx-menu__item${variant === "danger" ? " ctx-menu__item--danger" : ""}`}
        onClick={(e) => {
          e.stopPropagation();
          if (!disabled) onClick(id);
        }}
      >
        {icon && <span className="ctx-menu__icon" aria-hidden="true">{icon}</span>}
        {label}
      </button>
    </li>
  );
}
