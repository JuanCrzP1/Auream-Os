import "./pipeline-empty.css";
import { useState } from "react";
import { apiErrorMessage } from "@shared/http/apiErrorMessage";

const STEPS = [
  ["Crea tu embudo", "Empieza con Nuevo → Interesado → Pidió precio → Pagó → Entregado (y Perdido). Cámbialo cuando quieras."],
  ["Tus flujos mueven a los clientes", "Cada etapa es una etiqueta: el bloque Etiquetas que ya usas pasa al cliente de etapa solo."],
  ["Sigue a cada uno", "Ponle valor, responsable y un seguimiento. El tablero te dice cuánto falta por cerrar."]
] as const;

/** Sin embudos: qué es y, para quien puede configurarlo, crear el de ejemplo con un toque. */
export function PipelineEmpty({ canManage, onCreate }: { readonly canManage: boolean; readonly onCreate: () => Promise<unknown> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <section className="pipeline-empty" aria-labelledby="pipeline-empty-title">
      <h2 id="pipeline-empty-title">Arma tu embudo de ventas</h2>
      <p className="ui-muted">Mira en qué etapa va cada cliente, cuánto vale y qué seguimiento le toca.</p>
      <ol className="pipeline-empty__steps">
        {STEPS.map(([title, text], index) => (
          <li key={title}>
            <span className="pipeline-empty__number" aria-hidden="true">{index + 1}</span>
            <strong>{title}</strong>
            <span>{text}</span>
          </li>
        ))}
      </ol>
      {canManage ? (
        <button
          type="button"
          className="ui-btn ui-btn--primary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              await onCreate();
            } catch (e) {
              setError(apiErrorMessage(e, "No se pudo crear el embudo."));
              setBusy(false);
            }
          }}
        >
          {busy ? "Creando…" : "Crear mi embudo"}
        </button>
      ) : (
        <p className="pipeline-empty__note">Pide a un dueño o administrador que cree el embudo.</p>
      )}
      {error ? <p className="ui-error" role="alert">{error}</p> : null}
    </section>
  );
}
