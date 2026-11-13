import "./scheduled.css";
import { useState } from "react";
import type { ScheduledMessage } from "@contracts/ScheduledMessageContracts";
import { apiErrorMessage } from "@shared/http/apiErrorMessage";
import { ConfirmDialog } from "@shared/ui/dialog/ConfirmDialog";
import { MEDIA_LABEL } from "../composer/draft";
import { EditScheduledDialog } from "./EditScheduledDialog";
import { whenLabel } from "./scheduleModel";
import type { ScheduledMessages } from "./useScheduledMessages";

/**
 * Los programados del chat al final del hilo, como burbujas punteadas que
 * aún no salen (todo el equipo las ve):
 *   pendiente   «🕘 mañana, 9:00 a. m. · Ana»  Enviar ahora · Editar · Cancelar
 *   no salió    el motivo                       Reintentar · Descartar
 *   omitido     «el cliente respondió antes»   Enviar igual · Descartar
 */
export function ScheduledBubbles({
  scheduled,
  canWrite,
  onSent,
  onError
}: {
  readonly scheduled: ScheduledMessages;
  /** Quien mira puede enviar, editar y cancelar (si no, solo los ve). */
  readonly canWrite: boolean;
  /** Salió ya («Enviar ahora», «Reintentar»): el hilo lo trae. */
  readonly onSent: () => void;
  readonly onError: (text: string) => void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editing, setEditing] = useState<ScheduledMessage | null>(null);
  const [cancelling, setCancelling] = useState<ScheduledMessage | null>(null);
  const { messages, timeZone } = scheduled;
  if (!timeZone || messages.length === 0) return null;

  const act = async (id: string, action: () => Promise<void>, fallback: string) => {
    setBusyId(id);
    try {
      await action();
    } catch (error) {
      onError(apiErrorMessage(error, fallback));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="scheduled-list" aria-label="Mensajes programados">
      {messages.map((message) => {
        const busy = busyId === message.id || message.status === "sending";
        const issue = message.status === "failed" || message.status === "skipped";
        return (
          <article key={message.id} className={`scheduled${issue ? ` is-${message.status}` : ""}`} aria-busy={busy}>
            {message.parts.map((part, index) =>
              part.kind === "text" ? (
                <p key={index} className="scheduled__text">{part.text}</p>
              ) : (
                <p key={index} className="scheduled__file">📎 {part.media.fileName ?? MEDIA_LABEL[part.media.type]}{part.caption ? ` · ${part.caption}` : ""}</p>
              )
            )}
            <p className="scheduled__meta">
              {message.status === "sending" ? "Enviando…"
                : issue ? `No salió: ${message.error ?? "error de WhatsApp"}`
                : `🕘 ${whenLabel(new Date(message.sendAt), timeZone, new Date())}${message.authorName ? ` · ${message.authorName}` : ""}`}
              {message.status === "pending" && message.cancelIfReplied ? <span title="No sale si el cliente responde antes"> · si no responde</span> : null}
            </p>
            {canWrite && message.status !== "sending" ? (
              <div className="scheduled__actions">
                <button type="button" disabled={busy} onClick={() => void act(message.id, () => scheduled.sendNow(message.id).then(onSent), "No se pudo enviar.")}>
                  {message.status === "pending" ? "Enviar ahora" : message.status === "failed" ? "Reintentar" : "Enviar igual"}
                </button>
                {message.status === "pending" ? (
                  <button type="button" disabled={busy} onClick={() => setEditing(message)}>Editar</button>
                ) : null}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => (message.status === "pending" ? setCancelling(message) : void act(message.id, () => scheduled.cancel(message.id), "No se pudo descartar."))}
                >
                  {message.status === "pending" ? "Cancelar" : "Descartar"}
                </button>
              </div>
            ) : null}
          </article>
        );
      })}
      {editing ? <EditScheduledDialog message={editing} timeZone={timeZone} onSave={(request) => scheduled.update(editing.id, request)} onClose={() => setEditing(null)} /> : null}
      {cancelling ? (
        <ConfirmDialog
          title="¿Cancelar este mensaje programado?"
          message="No se le enviará al cliente. Si lo necesitas después, tendrás que programarlo de nuevo."
          confirmLabel="Sí, cancelarlo"
          busyLabel="Cancelando…"
          cancelLabel="Volver"
          onConfirm={() => scheduled.cancel(cancelling.id)}
          onClose={() => setCancelling(null)}
        />
      ) : null}
    </div>
  );
}
