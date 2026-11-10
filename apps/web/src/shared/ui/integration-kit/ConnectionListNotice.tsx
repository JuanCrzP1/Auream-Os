import "./integration-card.css";
import { useState } from "react";
import { RetryButton, StateCard } from "@shared/ui/state/StateCard";
import { StateIcons } from "@shared/ui/state/stateIcons";

export type ConnectionListStatus = "loading" | "ready" | "forbidden" | "unavailable" | "error";

/**
 * Lo que se ve de una lista de conexiones mientras no hay lista que mostrar:
 * cargando, error (con reintentar), sin acceso o cifrado sin configurar. La
 * usan la sección del kit y las secciones con diseño propio (el Píxel en Meta
 * Ads), que solo pintan su lista y su estado vacío.
 */
export function ConnectionListNotice({
  status,
  title,
  noun,
  onRetry
}: {
  readonly status: Exclude<ConnectionListStatus, "ready">;
  /** Nombre de lo que se lista, para el aviso de no disponible: «Píxeles de Meta». */
  readonly title: string;
  /** Cómo se nombra lo que lista, para los avisos: «tus píxeles». */
  readonly noun: string;
  readonly onRetry: () => Promise<unknown>;
}) {
  const [retrying, setRetrying] = useState(false);

  const retry = async () => {
    setRetrying(true);
    await onRetry();
    setRetrying(false);
  };

  if (status === "error" || retrying) {
    return (
      <StateCard
        role="alert"
        tone="warning"
        icon={StateIcons.offline}
        title={`No pudimos cargar ${noun}`}
        description="Parece un problema de conexión momentáneo. Vuelve a intentarlo en unos segundos."
        actions={<RetryButton busy={retrying} onRetry={() => void retry()} />}
      />
    );
  }
  if (status === "unavailable") {
    return (
      <StateCard
        tone="warning"
        icon={StateIcons.lock}
        title={`${title}: no disponible`}
        description="El servidor todavía no tiene configurado el cifrado de secretos. Pide al administrador de la plataforma que lo active."
      />
    );
  }
  if (status === "forbidden") {
    return <StateCard icon={StateIcons.lock} title={`Sin acceso a ${noun}`} description="Tu rol no permite ver estas conexiones. Pide acceso a un administrador." />;
  }
  return (
    <div className="ai-grid" aria-busy="true" aria-label={`Cargando ${noun}`}>
      <div className="ai-card ai-card--skeleton" />
      <div className="ai-card ai-card--skeleton" />
    </div>
  );
}
