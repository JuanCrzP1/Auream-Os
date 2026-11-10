import "@shared/ui/integration-kit/integration-card.css";
import { useEffect, useState } from "react";
import type { ConnectionSummary } from "@contracts/ConnectionContracts";
import type { WebhookMapping } from "@contracts/WebhookContracts";
import { fetchFlowOptions, type FlowOption } from "@shared/automations/flowOptions";
import { TagListInput } from "./TagListInput";

/**
 * Qué hacer con el contacto: etiquetas (poner y quitar) e iniciar un flujo por
 * un número de WhatsApp. A diferencia de Leona, las etiquetas no necesitan
 * número; iniciar el flujo sí (es por donde sale).
 */
export function WebhookActionsSection({
  mapping,
  connectionId,
  connections,
  labelNames,
  onMapping,
  onConnection
}: {
  readonly mapping: WebhookMapping;
  readonly connectionId: string | null;
  readonly connections: ReadonlyArray<ConnectionSummary>;
  readonly labelNames: ReadonlyArray<string>;
  readonly onMapping: (mapping: WebhookMapping) => void;
  readonly onConnection: (connectionId: string | null) => void;
}) {
  const [flows, setFlows] = useState<FlowOption[]>([]);
  useEffect(() => {
    void fetchFlowOptions().then(setFlows).catch(() => setFlows([]));
  }, []);
  const connection = connections.find((item) => item.id === connectionId);

  return (
    <>
      <section className="webhook-card" aria-labelledby="webhook-tags-title">
        <header className="webhook-card__head">
          <div>
            <h2 id="webhook-tags-title">Etiquetas del contacto</h2>
            <p className="ui-muted">Se aplican cada vez que llega un envío con un teléfono válido.</p>
          </div>
        </header>
        <div className="webhook-grid">
          <TagListInput label="Poner" value={mapping.addTags} suggestions={labelNames} onChange={(addTags) => onMapping({ ...mapping, addTags })} />
          <TagListInput label="Quitar" value={mapping.removeTags} suggestions={labelNames} onChange={(removeTags) => onMapping({ ...mapping, removeTags })} />
        </div>
      </section>

      <section className="webhook-card" aria-labelledby="webhook-flow-title">
        <header className="webhook-card__head">
          <div>
            <h2 id="webhook-flow-title">Iniciar un flujo</h2>
            <p className="ui-muted">Le escribe al cliente por el número elegido. Si ya está dentro de un flujo, este lo reemplaza.</p>
          </div>
        </header>
        <div className="webhook-grid">
          <label className="ui-field">
            <span>Número de WhatsApp</span>
            <select className="ui-input" value={connectionId ?? ""} onChange={(event) => onConnection(event.target.value || null)}>
              <option value="">Ninguno</option>
              {connections.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                  {item.status === "connected" ? "" : " (desconectado)"}
                </option>
              ))}
            </select>
          </label>
          <label className="ui-field">
            <span>Flujo</span>
            <select className="ui-input" value={mapping.flowId} disabled={!connectionId} onChange={(event) => onMapping({ ...mapping, flowId: event.target.value })}>
              <option value="">No iniciar ninguno</option>
              {flows.map((flow) => (
                <option key={flow.id} value={flow.id}>
                  {flow.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {!connectionId ? <p className="ui-muted">Elige un número para poder iniciar un flujo.</p> : null}
        {connection && connection.status !== "connected" ? <p className="ai-card__warning">«{connection.name}» está desconectado: mientras siga así, el flujo no se inicia (el contacto y sus etiquetas sí se guardan).</p> : null}
      </section>
    </>
  );
}
