import { useEffect, useState } from "react";
import type { WebhookDelivery, WebhookDeliveryOutcome } from "@contracts/WebhookContracts";
import { formatDateTime } from "@shared/format/formatDate";
import { RetryButton, StateCard } from "@shared/ui/state/StateCard";
import { StateIcons } from "@shared/ui/state/stateIcons";

const OUTCOMES: Readonly<Record<WebhookDeliveryOutcome, { readonly label: string; readonly tone: string }>> = {
  processed: { label: "Procesado", tone: "ok" },
  sample: { label: "Solo ejemplo", tone: "idle" },
  ignored: { label: "Ignorado", tone: "idle" },
  failed: { label: "Falló", tone: "ko" }
};

/** Historial del webhook (como la pestaña de Leona): cada envío con lo que se hizo, lo que falló y su contenido. */
export function WebhookHistory({ history, onLoad }: { readonly history: ReadonlyArray<WebhookDelivery> | null; readonly onLoad: () => Promise<void> }) {
  const [status, setStatus] = useState<"loading" | "ready" | "error">(history ? "ready" : "loading");
  const load = async () => {
    setStatus("loading");
    try {
      await onLoad();
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  };
  useEffect(() => {
    void load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- carga al abrir la pestaña

  if (status === "error") return <StateCard role="alert" tone="warning" icon={StateIcons.offline} title="No pudimos cargar el historial" description="Vuelve a intentarlo en unos segundos." actions={<RetryButton busy={false} onRetry={() => void load()} />} />;
  if (status === "loading" || !history) return <p className="ui-muted">Cargando historial…</p>;
  if (history.length === 0) return <StateCard icon={StateIcons.search} title="Todavía no llega ningún envío" description="Cuando tu sistema envíe datos a la dirección del webhook, aparecerán aquí con lo que se hizo." />;

  return (
    <div className="webhook-history">
      <div className="webhook-history__bar">
        <p className="ui-muted">Los últimos {history.length} envíos (se guardan 30 días).</p>
        <button type="button" className="ui-btn ui-btn--ghost" onClick={() => void load()}>Actualizar</button>
      </div>
      <ol className="webhook-history__list">
        {history.map((delivery) => (
          <li key={delivery.id} className="webhook-history__item">
            <div className="webhook-history__top">
              <span className={`webhook-outcome webhook-outcome--${OUTCOMES[delivery.outcome].tone}`}>{OUTCOMES[delivery.outcome].label}</span>
              <time dateTime={delivery.receivedAt}>{formatDateTime(delivery.receivedAt)}</time>
              {delivery.phone ? <span className="webhook-history__phone">+{delivery.phone}</span> : null}
              {delivery.flowStarted ? <span className="webhook-outcome webhook-outcome--ok">Flujo iniciado</span> : null}
            </div>
            {delivery.error ? <p className="ui-error">{delivery.error}</p> : null}
            {delivery.notes.length > 0 ? (
              <ul className="webhook-history__notes">
                {delivery.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            ) : null}
            <details>
              <summary>Ver lo que llegó</summary>
              <pre className="webhook-history__payload">{JSON.stringify(delivery.payload, null, 2)}</pre>
            </details>
          </li>
        ))}
      </ol>
    </div>
  );
}
