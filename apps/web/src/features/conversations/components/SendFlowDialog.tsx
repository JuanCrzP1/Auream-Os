import { useEffect, useId, useState } from "react";
import { fetchFlowOptions, type FlowOption } from "@shared/automations/flowOptions";
import { apiErrorMessage } from "@shared/http/apiErrorMessage";

// ---------------------------------------------------------------------------
// «Ejecutar flujo» en este chat (como en Leona): corta lo que el cliente esté
// haciendo en otro flujo y empieza el elegido desde su inicio; el bot queda
// activo.
// ---------------------------------------------------------------------------

export function SendFlowDialog({
  contactName,
  onSend,
  onClose
}: {
  readonly contactName: string;
  readonly onSend: (automationId: string) => Promise<{ readonly flowName: string; readonly sent: number; readonly failed: number }>;
  readonly onClose: () => void;
}) {
  const titleId = useId();
  const [flows, setFlows] = useState<FlowOption[] | null>(null);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchFlowOptions()
      .then(setFlows)
      .catch(() => setError("No se pudieron cargar tus flujos."));
  }, []);

  const visible = (flows ?? []).filter((flow) => flow.name.toLowerCase().includes(query.trim().toLowerCase()));

  const send = async (flow: FlowOption) => {
    setBusy(flow.id);
    setError(null);
    try {
      await onSend(flow.id);
      onClose();
    } catch (e) {
      setError(apiErrorMessage(e, "No se pudo ejecutar el flujo. Inténtalo de nuevo."));
      setBusy(null);
    }
  };

  return (
    <div className="ui-overlay" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={busy ? undefined : onClose}>
      <div className="ui-dialog ios-flow-dialog" onClick={(event) => event.stopPropagation()}>
        <h2 id={titleId}>Ejecutar flujo para {contactName}</h2>
        <p className="ui-muted">Si está dentro de otro flujo, lo termina y empieza el que elijas desde el inicio. El bot queda activo en este chat.</p>
        <input className="ui-input" type="search" value={query} placeholder="Buscar flujo…" aria-label="Buscar flujo" autoFocus onChange={(event) => setQuery(event.target.value)} />
        {flows === null && !error ? <p className="ui-muted" role="status">Cargando flujos…</p> : null}
        {flows && visible.length === 0 ? <p className="ui-muted">{flows.length === 0 ? "Aún no tienes flujos." : "Ningún flujo con ese nombre."}</p> : null}
        <ul className="ios-flow-list">
          {visible.map((flow) => (
            <li key={flow.id}>
              <button type="button" className="ios-flow-option" disabled={busy !== null} onClick={() => void send(flow)}>
                <span>{flow.name}</span>
                <span className="ios-flow-option__cta">{busy === flow.id ? "Ejecutando…" : "Ejecutar"}</span>
              </button>
            </li>
          ))}
        </ul>
        {error ? <p className="ui-error" role="alert">{error}</p> : null}
        <div className="ui-dialog__footer">
          <button type="button" className="ui-btn ui-btn--ghost" onClick={onClose} disabled={busy !== null}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}
