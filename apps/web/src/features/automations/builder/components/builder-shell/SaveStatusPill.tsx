import type { AutosaveStatus } from "../../hooks/builder/useBuilderAutosave";

interface SaveStatusPillProps {
  readonly status: AutosaveStatus;
}

/**
 * SaveStatusPill — cápsula que comunica el estado del autoguardado.
 *
 * Responsabilidad única: traducir el estado del autosave a algo legible. No
 * guarda, no reintenta y no decide nada: sólo presenta el estado que recibe.
 *
 * Comunica ESTADO, no acción: no es un botón, no es pulsable y lleva
 * `role="status"` para que un lector de pantalla anuncie los cambios.
 *
 * `idle` comparte presentación con `saved` a propósito: un workspace recién
 * cargado y sin editar no tiene cambios pendientes.
 *
 * Nota: que el estado `error` llegue aquí de forma fiable es trabajo de B7 —
 * hoy el autosave puede fallar en escenarios que no lo reportan. Esta cápsula
 * ya lo presenta correctamente cuando ocurre; no inventa un sistema nuevo.
 */

const LABELS: Record<AutosaveStatus, string> = {
  idle: "Guardado",
  saving: "Guardando...",
  saved: "Guardado",
  error: "Error al guardar"
};

function StatusIcon({ status }: SaveStatusPillProps) {
  if (status === "saving") {
    return (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
        <path d="M14 8a6 6 0 1 1-1.8-4.3" />
      </svg>
    );
  }

  if (status === "error") {
    return (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
        <circle cx="8" cy="8" r="6.2" />
        <line x1="8" y1="5" x2="8" y2="8.6" />
        <line x1="8" y1="11" x2="8" y2="11" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="3.5 8.5 6.5 11.5 12.5 4.5" />
    </svg>
  );
}

export function SaveStatusPill({ status }: SaveStatusPillProps) {
  return (
    <span
      className={`builder-topbar__save-pill builder-topbar__save-pill--${status}`}
      role="status"
    >
      <StatusIcon status={status} />
      {LABELS[status]}
    </span>
  );
}
