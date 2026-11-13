import { useId, useState, type FormEvent } from "react";
import { MAX_AGENT_MESSAGE_LENGTH, type AgentMessagePart } from "@contracts/ConversationContracts";
import type { ScheduledMessage, UpdateScheduledMessageRequest } from "@contracts/ScheduledMessageContracts";
import { apiErrorMessage } from "@shared/http/apiErrorMessage";
import { MEDIA_LABEL } from "../composer/draft";
import { wallOf, whenProblem, zoneLabel } from "./scheduleModel";
import { WhenPicker, type ScheduleChoice } from "./WhenPicker";

/**
 * Editar un programado que aún no sale: sus textos (los archivos quedan
 * como están), la hora y el aviso. Al guardar, «responde antes» se cuenta
 * desde ahora.
 */
export function EditScheduledDialog({
  message,
  timeZone,
  onSave,
  onClose
}: {
  readonly message: ScheduledMessage;
  readonly timeZone: string;
  readonly onSave: (request: UpdateScheduledMessageRequest) => Promise<void>;
  readonly onClose: () => void;
}) {
  const titleId = useId();
  const [now] = useState(() => new Date());
  const [parts, setParts] = useState<ReadonlyArray<AgentMessagePart>>(message.parts);
  // La hora guardada, al minuto (así se elige): si no se toca, no se manda.
  const [initial] = useState(() => wallOf(new Date(message.sendAt), timeZone));
  const [choice, setChoice] = useState<ScheduleChoice>({ when: { date: initial.date, time: initial.time }, cancelIfReplied: message.cancelIfReplied });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setText = (index: number, text: string) => setParts(parts.map((part, at) => (at === index && part.kind === "text" ? { ...part, text } : part)));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const timeChanged = choice.when.date !== initial.date || choice.when.time !== initial.time;
    const problem = timeChanged ? whenProblem(choice.when, timeZone, new Date()) : null;
    if (problem) return setError(problem);
    setBusy(true);
    setError(null);
    try {
      await onSave({ parts, cancelIfReplied: choice.cancelIfReplied, ...(timeChanged ? choice.when : {}) });
      onClose();
    } catch (e) {
      setError(apiErrorMessage(e, "No se pudo guardar el cambio."));
      setBusy(false);
    }
  };

  return (
    <div className="ui-overlay" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={busy ? undefined : onClose}>
      <div className="ui-dialog scheduled-edit" onClick={(event) => event.stopPropagation()}>
        <form onSubmit={(event) => void submit(event)}>
          <h2 id={titleId}>Editar mensaje programado</h2>
          <p className="ui-muted">{zoneLabel(timeZone)}</p>
          <div className="scheduled-edit__parts">
            {parts.map((part, index) =>
              part.kind === "text" ? (
                <textarea
                  key={index}
                  className="ui-input"
                  aria-label={parts.length > 1 ? `Mensaje ${index + 1}` : "Mensaje"}
                  rows={3}
                  maxLength={MAX_AGENT_MESSAGE_LENGTH}
                  value={part.text}
                  onChange={(event) => setText(index, event.target.value)}
                />
              ) : (
                <span key={index} className="scheduled-edit__file">
                  📎 {part.media.fileName ?? MEDIA_LABEL[part.media.type]}
                  {part.caption ? ` · ${part.caption}` : ""}
                </span>
              )
            )}
          </div>
          <WhenPicker timeZone={timeZone} now={now} value={choice} onChange={setChoice} />
          {error ? <p className="ui-error" role="alert">{error}</p> : null}
          <div className="ui-dialog__footer">
            <button type="button" className="ui-btn ui-btn--ghost" onClick={onClose} disabled={busy}>
              Cancelar
            </button>
            <button type="submit" className="ui-btn ui-btn--primary" disabled={busy}>
              {busy ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
