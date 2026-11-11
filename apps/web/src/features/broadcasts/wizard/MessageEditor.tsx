import { useRef, useState } from "react";
import { BROADCAST_LIMITS } from "@contracts/BroadcastContracts";
import { apiErrorMessage } from "@shared/http/apiErrorMessage";
import { uploadMedia } from "@shared/media/uploadMedia";
import type { MessageDraft } from "./broadcastDraft";

const NAME = "{first_name}";

/** Texto con el nombre de cada cliente y una foto o un video (opcional). */
export function MessageEditor({ message, onChange }: { readonly message: MessageDraft; readonly onChange: (message: MessageDraft) => void }) {
  const input = useRef<HTMLTextAreaElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const insertName = () => {
    const at = input.current?.selectionStart ?? message.text.length;
    onChange({ ...message, text: `${message.text.slice(0, at)}${NAME}${message.text.slice(at)}` });
    input.current?.focus();
  };

  const upload = async (picked: File | undefined) => {
    if (!picked) return;
    const type = picked.type.startsWith("video/") ? "video" : picked.type.startsWith("image/") ? "image" : null;
    if (!type) return setError("Elige una foto o un video.");
    setError(null);
    setUploading(0);
    try {
      const asset = await uploadMedia(picked, type, (percentage) => setUploading(Math.round(percentage)));
      onChange({ ...message, media: { type, url: asset.url, fileName: asset.fileName } });
    } catch (failure) {
      setError(apiErrorMessage(failure, "No se pudo subir el archivo."));
    } finally {
      setUploading(null);
    }
  };

  return (
    <div className="bc-message">
      <textarea
        ref={input}
        className="ui-input bc-message__text"
        rows={4}
        maxLength={BROADCAST_LIMITS.maxTextLength}
        value={message.text}
        placeholder="Hola {first_name} 👋 …"
        aria-label="Mensaje"
        onChange={(event) => onChange({ ...message, text: event.target.value })}
      />
      <div className="bc-message__tools">
        <button type="button" className="bc-chip" onClick={insertName}>+ Nombre del cliente</button>
        {message.media ? (
          <span className="bc-chip bc-chip--file">
            {message.media.type === "video" ? "🎬" : "📷"} {message.media.fileName ?? "Archivo"}
            <button type="button" aria-label="Quitar archivo" onClick={() => onChange({ ...message, media: null })}>✕</button>
          </span>
        ) : (
          <button type="button" className="bc-chip" disabled={uploading !== null} onClick={() => file.current?.click()}>
            {uploading !== null ? `Subiendo… ${uploading} %` : "📎 Foto o video"}
          </button>
        )}
        <input ref={file} type="file" accept="image/*,video/*" hidden onChange={(event) => void upload(event.target.files?.[0])} />
        <span className="bc-message__count">{message.text.length}/{BROADCAST_LIMITS.maxTextLength}</span>
      </div>
      <span className="bc-hint">Si no sabemos el nombre, dice «Hola 👋» sin dejar un hueco.</span>
      {error ? <p className="ui-error" role="alert">{error}</p> : null}
    </div>
  );
}
