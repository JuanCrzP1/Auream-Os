import "./wizard-kit.css";
import "./content-step.css";
import { BROADCAST_LIMITS } from "@contracts/BroadcastContracts";
import type { ConnectionSummary } from "@contracts/ConnectionContracts";
import type { FlowOption } from "@shared/automations/flowOptions";
import { VARIANT_LETTERS } from "../broadcastFormat";
import type { BroadcastDraft, MessageDraft } from "./broadcastDraft";
import { MessageEditor } from "./MessageEditor";
import { TestSend } from "./TestSend";

const MAX = BROADCAST_LIMITS.maxVariants;

/** Paso 1: un flujo (lo mejor para vender) o un mensaje con foto o video, en 1 a 3 versiones. */
export function ContentStep({ draft, update, flows, connections }: {
  readonly draft: BroadcastDraft;
  readonly update: (patch: Partial<BroadcastDraft>) => void;
  readonly flows: ReadonlyArray<FlowOption>;
  readonly connections: ReadonlyArray<ConnectionSummary>;
}) {
  const isFlow = draft.kind === "flow";
  const total = isFlow ? draft.flowIds.length : draft.messages.length;
  const setFlow = (index: number, id: string) => update({ flowIds: draft.flowIds.map((current, i) => (i === index ? id : current)) });
  const setMessage = (index: number, message: MessageDraft) => update({ messages: draft.messages.map((current, i) => (i === index ? message : current)) });
  const remove = (index: number) =>
    isFlow ? update({ flowIds: draft.flowIds.filter((_, i) => i !== index) }) : update({ messages: draft.messages.filter((_, i) => i !== index) });
  const add = () =>
    isFlow ? update({ flowIds: [...draft.flowIds, ""] }) : update({ messages: [...draft.messages, { text: draft.messages[0]?.text ?? "", media: draft.messages[0]?.media ?? null }] });

  return (
    <div className="bc-step">
      <div className="bc-step__head">
        <h2>¿Qué quieres enviar?</h2>
        <p>Con un flujo, el cliente responde y el flujo sigue solo: ofrece, cobra y registra la venta.</p>
      </div>
      <div className="bc-choices">
        <button type="button" className="bc-choice" aria-pressed={isFlow} onClick={() => update({ kind: "flow" })}>
          <strong>Un flujo</strong>
          <span>El cliente responde y el flujo sigue. Lo mejor para vender.</span>
        </button>
        <button type="button" className="bc-choice" aria-pressed={!isFlow} onClick={() => update({ kind: "message" })}>
          <strong>Un mensaje</strong>
          <span>Texto con foto o video. Lo que respondan llega a Conversaciones.</span>
        </button>
      </div>

      {Array.from({ length: total }, (_, index) => (
        <div key={index} className="bc-variant">
          {total > 1 ? (
            <div className="bc-variant__head">
              <span className="bc-variant__letter">Versión {VARIANT_LETTERS[index]}</span>
              <button type="button" className="ui-link" onClick={() => remove(index)}>Quitar</button>
            </div>
          ) : null}
          {isFlow ? (
            <label className="ui-field">
              <span>Flujo</span>
              <select className="ui-input" value={draft.flowIds[index]} onChange={(event) => setFlow(index, event.target.value)}>
                <option value="">Elige un flujo…</option>
                {flows.map((flow) => (
                  <option key={flow.id} value={flow.id}>{flow.name}</option>
                ))}
              </select>
            </label>
          ) : (
            <MessageEditor message={draft.messages[index]!} onChange={(message) => setMessage(index, message)} />
          )}
        </div>
      ))}

      {total < MAX ? (
        <button type="button" className="bc-add-variant" onClick={add}>
          + Agregar otra versión
          <span>Cada persona recibe una al azar: así WhatsApp no ve cientos de mensajes idénticos.</span>
        </button>
      ) : null}

      <TestSend draft={draft} connections={connections} />
    </div>
  );
}
