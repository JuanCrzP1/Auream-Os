import type { ComponentType } from "react";
import type { IntervalTrigger } from "@contracts/IntervalConfig";

// Signos del Programador, compartidos por el editor y el nodo cerrado.
// `currentColor`, para que cada sitio decida el tono.

/** Reloj: una espera contada desde ahora. */
export function WaitIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="10" cy="10.5" r="6.5" />
      <path d="M10 6.75v3.75l2.5 1.6" />
    </svg>
  );
}

/** Calendario: un día concreto. */
export function DateIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4.5" width="14" height="12.5" rx="2" />
      <path d="M3 8.5h14M7 2.75v3M13 2.75v3" />
      <circle cx="10" cy="12.5" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Tramos semanales: la restricción horaria. */
export function ScheduleIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
      <path d="M3 6.5h7M3 10.5h11M3 14.5h5" />
      <circle cx="15.5" cy="6.5" r="1.6" />
      <circle cx="16.5" cy="10.5" r="1.6" />
    </svg>
  );
}

/** Icono de cada momento principal. El horario no está: no es un momento. */
export const TRIGGER_ICON: Readonly<Record<IntervalTrigger, ComponentType>> = {
  interval: WaitIcon,
  date: DateIcon
};
