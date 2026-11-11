import { useState } from "react";
import type { BroadcastContent } from "@contracts/BroadcastContracts";
import type { ConnectionSummary } from "@contracts/ConnectionContracts";
import { apiErrorMessage } from "@shared/http/apiErrorMessage";
import { broadcastsApi } from "../services/broadcastsApi";
import type { BroadcastDraft } from "./broadcastDraft";
import { canBroadcast } from "./numbers";

const PHONE_KEY = "auream.broadcasts.testPhone";
const remembered = () => {
  try {
    return window.localStorage.getItem(PHONE_KEY) ?? "";
  } catch {
    return "";
  }
};

/** Enviarse la primera versión al propio WhatsApp antes de mandarla a todos. */
export function TestSend({ draft, connections }: { readonly draft: BroadcastDraft; readonly connections: ReadonlyArray<ConnectionSummary> }) {
  const [phone, setPhone] = useState(remembered);
  const [state, setState] = useState<{ readonly kind: "idle" | "busy" | "ok" | "error"; readonly text?: string }>({ kind: "idle" });
  const connection = connections.find((c) => draft.connectionIds.includes(c.id) && canBroadcast(c)) ?? connections.find(canBroadcast);
  const content: BroadcastContent | null =
    draft.kind === "flow"
      ? draft.flowIds[0] ? { kind: "flow", automationId: draft.flowIds[0] } : null
      : draft.messages[0] && (draft.messages[0].text.trim() || draft.messages[0].media) ? { kind: "message", text: draft.messages[0].text, media: draft.messages[0].media } : null;

  const send = async () => {
    if (!content || !connection) return;
    setState({ kind: "busy" });
    try {
      window.localStorage.setItem(PHONE_KEY, phone);
    } catch {
      // Recordar el número es solo una comodidad.
    }
    try {
      const result = await broadcastsApi.test(content, connection.id, phone, draft.settings.optOutFooter);
      setState(result.ok ? { kind: "ok", text: `Listo: revisa tu WhatsApp (salió por «${connection.name}»).` } : { kind: "error", text: result.error ?? "WhatsApp no la aceptó." });
    } catch (failure) {
      setState({ kind: "error", text: apiErrorMessage(failure, "No se pudo enviar la prueba.") });
    }
  };

  return (
    <div className="bc-test">
      <div>
        <strong>Enviarme una prueba</strong>
        <span className="bc-hint">{draft.kind === "flow" ? "El flujo corre de verdad en tu chat." : "Te llega tal como la verá un cliente."}</span>
      </div>
      <div className="bc-test__row">
        <input className="ui-input" inputMode="tel" placeholder="Tu WhatsApp, ej. 573001234567" value={phone} aria-label="Tu WhatsApp" onChange={(event) => setPhone(event.target.value)} />
        <button type="button" className="ui-btn" disabled={!content || !connection || phone.replace(/\D/g, "").length < 8 || state.kind === "busy"} onClick={() => void send()}>
          {state.kind === "busy" ? "Enviando…" : "Enviarme"}
        </button>
      </div>
      {!connection ? <span className="bc-hint">Conecta un número por QR para poder probar.</span> : null}
      {state.text ? <span className={state.kind === "ok" ? "bc-test__ok" : "ui-error"} role="status">{state.text}</span> : null}
    </div>
  );
}
