import { useState } from "react";
import { formatDateTime } from "@shared/format/formatDate";

/**
 * La dirección secreta del webhook (copiar) y la escucha del envío de
 * ejemplo: mandas un POST real y aparece a la derecha para mapear con clic.
 */
export function WebhookAddressCard({
  url,
  sampleReceivedAt,
  listening,
  onListen,
  onCancel
}: {
  readonly url: string;
  readonly sampleReceivedAt: string | null;
  readonly listening: boolean;
  readonly onListen: () => void;
  readonly onCancel: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2_000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section className="webhook-card" aria-labelledby="webhook-address-title">
      <header className="webhook-card__head">
        <div>
          <h2 id="webhook-address-title">Dirección del webhook</h2>
          <p className="ui-muted">Pégala en tu sistema para que envíe los datos con <code>POST</code> (JSON o formulario). Es secreta: no la compartas.</p>
        </div>
      </header>
      <div className="webhook-address">
        <input className="ui-input webhook-address__url" readOnly value={url} aria-label="Dirección del webhook" onFocus={(event) => event.target.select()} />
        <button type="button" className="ui-btn ui-btn--ghost" onClick={() => void copy()}>
          {copied ? "Copiada" : "Copiar"}
        </button>
        {listening ? (
          <button type="button" className="ui-btn ui-btn--ghost webhook-address__listening" onClick={onCancel}>
            <span className="webhook-pulse" aria-hidden="true" /> Esperando envío… (cancelar)
          </button>
        ) : (
          <button type="button" className="ui-btn ui-btn--primary" onClick={onListen}>
            Esperar envío de ejemplo
          </button>
        )}
      </div>
      <p className="ui-muted webhook-address__hint">
        {sampleReceivedAt ? `Último envío recibido: ${formatDateTime(sampleReceivedAt)}.` : "Todavía no llega ningún envío. Manda uno real y usa «Esperar envío de ejemplo»."}
      </p>
    </section>
  );
}
