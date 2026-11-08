import type { ComponentType } from "react";
import type { IntervalTrigger } from "@contracts/IntervalConfig";
import { DateIcon, WaitIcon } from "../intervalModeIcons";

interface TriggerOption {
  readonly trigger: IntervalTrigger;
  /** Texto corto de la pestaña. */
  readonly label: string;
  /** Nombre completo para lectores de pantalla. */
  readonly accessibleName: string;
  readonly Icon: ComponentType;
}

const OPTIONS: ReadonlyArray<TriggerOption> = [
  { trigger: "interval", label: "Después", accessibleName: "Después de un tiempo", Icon: WaitIcon },
  { trigger: "date", label: "Fecha", accessibleName: "En una fecha", Icon: DateIcon }
];

interface IntervalTriggerPickerProps {
  readonly value: IntervalTrigger;
  readonly onChange: (trigger: IntervalTrigger) => void;
}

/** Momento principal: grupo de radio con forma de pestañas del panel. */
export function IntervalTriggerPicker({ value, onChange }: IntervalTriggerPickerProps) {
  return (
    <div className="iv-tabs" role="radiogroup" aria-label="Cuándo debe continuar">
      {OPTIONS.map(({ trigger, label, accessibleName, Icon }) => (
        <button
          key={trigger}
          type="button"
          role="radio"
          aria-checked={value === trigger}
          aria-label={accessibleName}
          className={`iv-tab nodrag${value === trigger ? " iv-tab--on" : ""}`}
          onClick={() => onChange(trigger)}
        >
          <span className="iv-tab__icon" aria-hidden="true">
            <Icon />
          </span>
          <span className="iv-tab__label">{label}</span>
        </button>
      ))}
    </div>
  );
}
