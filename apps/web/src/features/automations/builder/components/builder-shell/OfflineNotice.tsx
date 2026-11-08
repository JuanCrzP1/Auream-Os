interface OfflineNoticeProps {
  readonly onRetry: () => void;
}

/**
 * Aviso permanente cuando el builder abrió el respaldo EN MEMORIA porque la API
 * no respondió: nada de lo que se edite se guardará. «Reintentar» vuelve a
 * cargar el flujo desde el servidor y descarta lo editado sin conexión.
 */
export function OfflineNotice({ onRetry }: OfflineNoticeProps) {
  return (
    <div className="builder-offline" role="alert">
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M1.5 5.6a9.6 9.6 0 0 1 13 0M3.7 8a6.3 6.3 0 0 1 8.6 0M6 10.4a3 3 0 0 1 4 0" />
        <path d="M2 2l12 12" />
      </svg>
      <span className="builder-offline__text">
        <strong>Sin conexión con el servidor.</strong> Lo que edites no se guardará.
      </span>
      <button type="button" className="builder-offline__retry" onClick={onRetry}>
        Reintentar
      </button>
    </div>
  );
}
