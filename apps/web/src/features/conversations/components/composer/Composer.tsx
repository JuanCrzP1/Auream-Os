import "./composer.css";
import { useCallback, useRef, useState } from "react";
import { MAX_AGENT_MESSAGE_LENGTH, type ConversationMessage, type SendAgentMessageRequest } from "@contracts/ConversationContracts";
import type { QuickReply } from "@contracts/QuickReplyContracts";
import { apiErrorMessage } from "@shared/http/apiErrorMessage";
import { markQuickReplyUsed } from "@shared/quick-replies/quickRepliesApi";
import type { useQuickReplies } from "@shared/quick-replies/useQuickReplies";
import { ComposerTools } from "./ComposerTools";
import { applyQuickReply, toParts } from "./draft";
import { PendingPieces } from "./PendingPieces";
import { QuickReplyEditor } from "./QuickReplyEditor";
import { QuickReplyPicker, type QuickReplyPickerHandle } from "./QuickReplyPicker";
import { useDraftPieces } from "./useDraftPieces";
import { useVoiceRecorder } from "./useVoiceRecorder";
import { SendOrRecordButton, VoiceRecordingBar } from "./VoiceRecordingBar";
import { EmojiPicker } from "./EmojiPicker";

// ---------------------------------------------------------------------------
// La barra para responder: respuestas rápidas (⚡ o «/» al empezar), adjuntar
// archivos, emojis, el texto y, sin texto, grabar una nota de voz (como
// WhatsApp). Lo que está en espera (archivos, piezas de una respuesta
// rápida) sale antes del texto, en orden; si se cita un mensaje, lo cita el
// primero.
// ---------------------------------------------------------------------------

type Popover = { readonly kind: "quick"; readonly fromSlash: boolean } | { readonly kind: "emoji" } | null;

/** «/salu» solo en el cuadro: está buscando una respuesta rápida. */
const slashQuery = (text: string) => (/^\/[^\n]{0,40}$/.test(text) ? text.slice(1) : null);

export function Composer({
  contactName,
  quickReplies,
  replyTo,
  onCancelReply,
  onSend,
  onError
}: {
  readonly contactName: string | null;
  readonly quickReplies: ReturnType<typeof useQuickReplies>;
  readonly replyTo: ConversationMessage | null;
  readonly onCancelReply: () => void;
  readonly onSend: (request: SendAgentMessageRequest) => Promise<void>;
  readonly onError: (message: string | null) => void;
}) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [popover, setPopover] = useState<Popover>(null);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<{ readonly reply: QuickReply | null } | null>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const picker = useRef<QuickReplyPickerHandle>(null);
  const draft = useDraftPieces(onError);

  const submit = async (request: SendAgentMessageRequest) => {
    setSending(true);
    onError(null);
    try {
      await onSend(replyTo ? { ...request, replyToId: replyTo.id } : request);
      return true;
    } catch (error) {
      onError(apiErrorMessage(error, "No se pudo enviar el mensaje."));
      return false;
    } finally {
      setSending(false);
    }
  };

  const send = async () => {
    if (sending) return;
    if (draft.uploading) return onError("Espera a que terminen de subirse los archivos.");
    const parts = toParts(draft.pieces, text);
    if (parts.length === 0) return;
    if (await submit({ parts })) {
      setText("");
      draft.clear();
      onCancelReply();
      input.current?.focus();
    }
  };

  // La nota de voz sale apenas se suelta (como WhatsApp), con la cita que haya en ese momento.
  const latestSubmit = useRef(submit);
  latestSubmit.current = submit;
  const { attach, remove } = draft;
  const recorder = useVoiceRecorder(
    useCallback(async (file: File) => {
      const piece = await attach(file, { voice: true });
      if (piece?.kind !== "media") return;
      remove(piece.id);
      if (await latestSubmit.current({ parts: [{ kind: "media", media: piece.media }] })) onCancelReply();
    }, [attach, remove, onCancelReply]),
    useCallback((message: string) => onError(message), [onError])
  );

  const pickQuickReply = (reply: QuickReply) => {
    const applied = applyQuickReply(reply, contactName);
    markQuickReplyUsed(reply.id);
    setPopover(null);
    setSearch("");
    if (applied.text !== undefined) setText(applied.text);
    else if (popover?.kind === "quick" && popover.fromSlash) setText("");
    draft.add(applied.pieces);
    requestAnimationFrame(() => input.current?.focus());
  };

  const insertEmoji = (emoji: string) => {
    const element = input.current;
    const start = element?.selectionStart ?? text.length;
    const end = element?.selectionEnd ?? text.length;
    setText(text.slice(0, start) + emoji + text.slice(end));
    requestAnimationFrame(() => {
      element?.focus();
      element?.setSelectionRange(start + emoji.length, start + emoji.length);
    });
  };

  const onText = (value: string) => {
    setText(value);
    const query = slashQuery(value);
    if (query !== null) setPopover({ kind: "quick", fromSlash: true });
    else if (popover?.kind === "quick" && popover.fromSlash) setPopover(null);
  };

  const quickQuery = popover?.kind === "quick" && popover.fromSlash ? (slashQuery(text) ?? "") : search;
  const empty = !text.trim() && draft.pieces.length === 0;

  return (
    <footer className="ios-composer chat-composer">
      {popover?.kind === "quick" ? (
        <QuickReplyPicker
          ref={picker}
          replies={quickReplies.replies}
          status={quickReplies.status}
          canWrite={quickReplies.canWrite}
          query={quickQuery}
          searchable={!popover.fromSlash}
          onQuery={setSearch}
          onPick={pickQuickReply}
          onNew={() => setEditing({ reply: null })}
          onEdit={(reply) => setEditing({ reply })}
          onRetry={() => void quickReplies.reload()}
          onClose={() => setPopover(null)}
        />
      ) : null}
      {popover?.kind === "emoji" ? <EmojiPicker onPick={insertEmoji} onClose={() => setPopover(null)} /> : null}

      <PendingPieces replyTo={replyTo} pieces={draft.pieces} onCancelReply={onCancelReply} onRemove={draft.remove} />

      {recorder.state === "recording" ? (
        <VoiceRecordingBar seconds={recorder.seconds} onStop={recorder.stop} />
      ) : (
        <div className="chat-composer__row">
          <ComposerTools
            popover={popover?.kind ?? null}
            onQuick={() => setPopover(popover?.kind === "quick" ? null : { kind: "quick", fromSlash: false })}
            onEmoji={() => setPopover(popover?.kind === "emoji" ? null : { kind: "emoji" })}
            onFiles={(files) => files.forEach((file) => void draft.attach(file))}
          />
          <textarea
            ref={input}
            className="ios-composer__input"
            value={text}
            rows={1}
            maxLength={MAX_AGENT_MESSAGE_LENGTH}
            placeholder="Escribe un mensaje o «/» para respuestas rápidas"
            aria-label="Escribe un mensaje"
            onChange={(event) => onText(event.target.value)}
            onKeyDown={(event) => {
              if (popover?.kind === "quick" && popover.fromSlash && picker.current?.handleKey(event)) {
                event.preventDefault();
                return;
              }
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void send();
              }
            }}
          />
          <SendOrRecordButton empty={empty} busy={sending || draft.uploading} onSend={() => void send()} onRecord={() => void recorder.start()} />
        </div>
      )}

      {editing ? (
        <QuickReplyEditor
          reply={editing.reply}
          onSave={(request) => quickReplies.save(request, editing.reply?.id)}
          onDelete={() => quickReplies.remove(editing.reply!.id)}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </footer>
  );
}
