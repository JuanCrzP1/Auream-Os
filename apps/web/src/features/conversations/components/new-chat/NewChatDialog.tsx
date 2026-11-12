import "./new-chat.css";
import { useEffect, useId, useState } from "react";
import type { ConnectionSummary } from "@contracts/ConnectionContracts";
import type { ConversationSummary, StartConversationRequest } from "@contracts/ConversationContracts";
import type { QuickReply } from "@contracts/QuickReplyContracts";
import { fetchFlowOptions, type FlowOption } from "@shared/automations/flowOptions";
import { apiErrorMessage } from "@shared/http/apiErrorMessage";
import { markQuickReplyUsed } from "@shared/quick-replies/quickRepliesApi";
import { CountryDialPicker } from "@shared/ui/country-dial/CountryDialPicker";
import { applyQuickReply, toParts } from "../composer/draft";

type FirstMessage = "text" | "quick" | "flow";

const OPTIONS: ReadonlyArray<{ readonly value: FirstMessage; readonly label: string }> = [
  { value: "text", label: "Escribir" },
  { value: "quick", label: "Respuesta rápida" },
  { value: "flow", label: "Un flujo" }
];

/**
 * «Chat nuevo»: escribirle primero a un número desde uno de tus números
 * conectados. El primer mensaje se escribe, sale de una respuesta rápida o es
 * un flujo. Si ese cliente ya tenía chat por ese número, se abre el mismo.
 */
export function NewChatDialog({
  connections,
  quickReplies,
  onStart,
  onClose
}: {
  readonly connections: ReadonlyArray<ConnectionSummary>;
  readonly quickReplies: ReadonlyArray<QuickReply>;
  readonly onStart: (request: StartConversationRequest) => Promise<ConversationSummary>;
  readonly onClose: () => void;
}) {
  const titleId = useId();
  const connected = connections.filter((connection) => connection.status === "connected");
  const [connectionId, setConnectionId] = useState(connected[0]?.id ?? "");
  const [dial, setDial] = useState("57");
  const [number, setNumber] = useState("");
  const [name, setName] = useState("");
  const [kind, setKind] = useState<FirstMessage>("text");
  const [text, setText] = useState("");
  const [replyId, setReplyId] = useState(quickReplies[0]?.id ?? "");
  const [flows, setFlows] = useState<FlowOption[] | null>(null);
  const [flowId, setFlowId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (kind !== "flow" || flows) return;
    fetchFlowOptions()
      .then((list) => {
        setFlows(list);
        setFlowId((current) => current || list[0]?.id || "");
      })
      .catch(() => setFlows([]));
  }, [kind, flows]);

  const reply = quickReplies.find((item) => item.id === replyId);
  const digits = number.replace(/\D/g, "");
  const ready = Boolean(connectionId) && digits.length >= 6 && (kind === "text" ? text.trim() : kind === "quick" ? reply : flowId);

  const start = async () => {
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    const base = { connectionId, phone: `${dial}${digits}`, ...(name.trim() ? { name: name.trim() } : {}) };
    try {
      if (kind === "flow") await onStart({ ...base, automationId: flowId });
      else if (kind === "quick" && reply) {
        const applied = applyQuickReply(reply, name.trim() || null);
        await onStart({ ...base, message: { parts: toParts(applied.pieces, applied.text ?? "") } });
        markQuickReplyUsed(reply.id);
      } else await onStart({ ...base, message: { text: text.trim() } });
      onClose();
    } catch (e) {
      setError(apiErrorMessage(e, "No se pudo iniciar el chat."));
      setBusy(false);
    }
  };

  return (
    <div className="ui-overlay" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={busy ? undefined : onClose}>
      <div className="ui-dialog new-chat" onClick={(event) => event.stopPropagation()}>
        <h2 id={titleId}>Chat nuevo</h2>
        <p className="ui-muted">Escríbele primero a un cliente. Queda en Contactos y su chat se abre aquí.</p>
        {connected.length === 0 ? (
          <p className="ui-error" role="alert">No tienes números de WhatsApp conectados. Conecta uno en Conexiones para escribir desde él.</p>
        ) : (
          <>
            {connected.length > 1 ? (
              <label className="new-chat__field">
                <span>Desde</span>
                <select className="ui-input" value={connectionId} onChange={(event) => setConnectionId(event.target.value)}>
                  {connected.map((connection) => <option key={connection.id} value={connection.id}>{connection.name}</option>)}
                </select>
              </label>
            ) : null}
            <div className="new-chat__field">
              <span id={`${titleId}-phone`}>WhatsApp del cliente</span>
              <div className="new-chat__phone">
                <CountryDialPicker value={dial} onChange={setDial} ariaLabel="Prefijo del país" />
                <input className="ui-input" inputMode="tel" autoFocus aria-labelledby={`${titleId}-phone`} placeholder="300 123 4567" value={number} onChange={(event) => setNumber(event.target.value)} />
              </div>
            </div>
            <label className="new-chat__field">
              <span>Nombre <small>(opcional)</small></span>
              <input className="ui-input" maxLength={80} placeholder="Laura Gómez" value={name} onChange={(event) => setName(event.target.value)} />
            </label>
            <div className="new-chat__field">
              <span>Primer mensaje</span>
              <div className="new-chat__kinds" role="radiogroup" aria-label="Primer mensaje">
                {OPTIONS.map((option) => (
                  <button key={option.value} type="button" role="radio" aria-checked={kind === option.value} className="new-chat__kind" onClick={() => setKind(option.value)}>
                    {option.label}
                  </button>
                ))}
              </div>
              {kind === "text" ? <textarea className="ui-input" rows={3} maxLength={4096} placeholder="Hola, te escribo de…" aria-label="Mensaje" value={text} onChange={(event) => setText(event.target.value)} /> : null}
              {kind === "quick" ? (
                quickReplies.length === 0 ? (
                  <p className="ui-muted">Aún no hay respuestas rápidas. Créalas en Configuración › Respuestas rápidas.</p>
                ) : (
                  <select className="ui-input" aria-label="Respuesta rápida" value={replyId} onChange={(event) => setReplyId(event.target.value)}>
                    {quickReplies.map((item) => <option key={item.id} value={item.id}>/{item.shortcut}{item.category ? ` · ${item.category}` : ""}</option>)}
                  </select>
                )
              ) : null}
              {kind === "flow" ? (
                flows === null ? <p className="ui-muted">Cargando flujos…</p>
                : flows.length === 0 ? <p className="ui-muted">Aún no tienes flujos.</p>
                : (
                  <select className="ui-input" aria-label="Flujo" value={flowId} onChange={(event) => setFlowId(event.target.value)}>
                    {flows.map((flow) => <option key={flow.id} value={flow.id}>{flow.name}</option>)}
                  </select>
                )
              ) : null}
              {kind === "flow" ? <small className="ui-muted">El flujo le escribe desde su inicio y el bot atiende el chat.</small> : null}
            </div>
          </>
        )}
        {error ? <p className="ui-error" role="alert">{error}</p> : null}
        <div className="ui-dialog__footer">
          <button type="button" className="ui-btn ui-btn--ghost" disabled={busy} onClick={onClose}>Cancelar</button>
          <button type="button" className="ui-btn ui-btn--primary" disabled={!ready || busy} onClick={() => void start()}>{busy ? "Enviando…" : "Iniciar chat"}</button>
        </div>
      </div>
    </div>
  );
}
