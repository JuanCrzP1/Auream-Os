interface OfflineNoticeProps {
  /** `offline`: la API no respondió. `conflict`: el servidor tiene una versión más nueva (C4). */
  readonly reason?: "offline" | "conflict";
  readonly onRetry: () => void;
}

const COPY = {
  offline: {
    title: "Sin conexión con el servidor.",
    detail: "Lo que edites no se guardará.",
    action: "Reintentar"
  },
  conflict: {
    title: "Este flujo cambió en otra pestaña o lo editó otra persona.",
    detail: "Para no borrar ese trabajo ya no se guarda aquí. Recarga para ver la última versión.",
    action: "Recargar"
  }
} as const;

/**
 * Aviso permanente cuando lo que se edita ya no se puede guardar: sin servidor
 * (respaldo en memoria) o con conflicto de versión. La acción vuelve a cargar
 * el flujo desde el servidor y descarta lo que no se pudo guardar.
 */
export function OfflineNotice({ reason = "offline", onRetry }: OfflineNoticeProps) {
  const copy = COPY[reason];

  return (
    <div className="builder-offline" role="alert">
      {reason === "offline" ? (
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M1.5 5.6a9.6 9.6 0 0 1 13 0M3.7 8a6.3 6.3 0 0 1 8.6 0M6 10.4a3 3 0 0 1 4 0" />
          <path d="M2 2l12 12" />
        </svg>
      ) : (
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M13.5 8A5.5 5.5 0 1 1 11.9 4.1M13.5 2.5v3h-3" />
        </svg>
      )}
      <span className="builder-offline__text">
        <strong>{copy.title}</strong> {copy.detail}
      </span>
      <button type="button" className="builder-offline__retry" onClick={onRetry}>
        {copy.action}
      </button>
    </div>
  );
}
