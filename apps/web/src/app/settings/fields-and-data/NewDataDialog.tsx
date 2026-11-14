import { useId } from "react";
import type { DataTab } from "./DataSettings";

const OPTIONS: ReadonlyArray<{ readonly id: DataTab; readonly title: string; readonly detail: string; readonly example: string; readonly icon: JSX.Element }> = [
  {
    id: "customer",
    title: "Campo del cliente",
    detail: "Cambia con cada persona.",
    example: "Su ciudad, su cumpleaños, su talla",
    icon: <svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.5" /><path d="M5 20a7 7 0 0 1 14 0" /></svg>
  },
  {
    id: "business",
    title: "Dato del negocio",
    detail: "Es igual para todos tus clientes.",
    example: "Tu horario, tu dirección, tu link de pago",
    icon: <svg viewBox="0 0 24 24"><path d="M4 20V9l8-5 8 5v11" /><path d="M9 20v-5h6v5M4 20h16" /></svg>
  }
];

/**
 * «Nuevo dato»: primero la pregunta que decide todo, con un ejemplo de cada
 * respuesta. Así nadie tiene que saber de antemano en qué pestaña crearlo.
 */
export function NewDataDialog({ current, onChoose, onClose }: { readonly current: DataTab; readonly onChoose: (tab: DataTab) => void; readonly onClose: () => void }) {
  const titleId = useId();
  return (
    <div className="ui-overlay" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={onClose}>
      <div className="ui-dialog data-choice" onClick={(e) => e.stopPropagation()}>
        <h2 id={titleId}>¿Qué vas a guardar?</h2>
        <p className="ui-muted">¿El dato cambia con cada cliente, o es igual para todos?</p>
        <div className="data-choice__options">
          {OPTIONS.map((option) => (
            <button key={option.id} type="button" className={`data-choice__option${option.id === current ? " is-current" : ""}`} onClick={() => onChoose(option.id)} autoFocus={option.id === current}>
              <span className="data-choice__icon" aria-hidden="true">{option.icon}</span>
              <span className="data-choice__text">
                <strong>{option.title}</strong>
                <span>{option.detail}</span>
                <small>{option.example}</small>
              </span>
            </button>
          ))}
        </div>
        <div className="ui-dialog__footer">
          <button type="button" className="ui-btn ui-btn--ghost" onClick={onClose}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}
