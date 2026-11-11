import { useRef, useState } from "react";
import { GROUP_LIMITS } from "@contracts/GroupContracts";
import { apiErrorMessage } from "@shared/http/apiErrorMessage";
import { uploadMedia } from "@shared/media/uploadMedia";
import { KINDS, type PostDraft } from "./postDraft";

/** Qué enviar (texto, foto, video, audio o encuesta), avisar a todos y cuándo. */
export function PostContent({ draft, update }: { readonly draft: PostDraft; readonly update: (patch: Partial<PostDraft>) => void }) {
  const file = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isFile = draft.kind === "image" || draft.kind === "video" || draft.kind === "audio";

  const upload = async (picked: File | undefined) => {
    if (!picked || !isFile) return;
    setError(null);
    setUploading(0);
    try {
      const asset = await uploadMedia(picked, draft.kind as "image" | "video" | "audio", (pct) => setUploading(Math.round(pct)));
      update({ media: { url: asset.url, fileName: asset.fileName } });
    } catch (failure) {
      setError(apiErrorMessage(failure, "No se pudo subir el archivo."));
    } finally {
      setUploading(null);
    }
  };

  return (
    <>
      <div className="gr-send__block">
        <span className="gr-send__label">Qué enviar</span>
        <div className="gr-send__kinds" role="tablist" aria-label="Tipo de mensaje">
          {KINDS.map(([kind, label]) => (
            <button key={kind} type="button" role="tab" aria-selected={draft.kind === kind} onClick={() => update({ kind, media: null })}>{label}</button>
          ))}
        </div>
        {isFile ? (
          <div className="gr-send__upload">
            <button type="button" className="ui-btn" disabled={uploading !== null} onClick={() => file.current?.click()}>
              {uploading !== null ? `Subiendo… ${uploading} %` : draft.media ? `✓ ${draft.media.fileName} · cambiar` : `Subir ${draft.kind === "image" ? "la foto" : draft.kind === "video" ? "el video" : "el audio"}`}
            </button>
            <input ref={file} type="file" hidden accept={draft.kind === "image" ? "image/*" : draft.kind === "video" ? "video/*" : "audio/*"} onChange={(event) => void upload(event.target.files?.[0])} />
            {error ? <span className="ui-error">{error}</span> : null}
          </div>
        ) : null}
        {draft.kind !== "audio" ? (
          <textarea
            className="ui-input gr-send__text"
            rows={4}
            maxLength={GROUP_LIMITS.maxPostText}
            value={draft.text}
            aria-label={draft.kind === "poll" ? "Pregunta" : isFile ? "Leyenda" : "Mensaje"}
            placeholder={draft.kind === "poll" ? "¿Para quién es tu canción?" : isFile ? "Leyenda (opcional)" : "🎄 ¡Abrimos los cupos! …"}
            onChange={(event) => update({ text: event.target.value })}
          />
        ) : null}
        {draft.kind === "poll" ? (
          <div className="gr-send__choices">
            {draft.choices.map((choice, index) => (
              <span key={index} className="gr-send__choice-row">
                <input className="ui-input" value={choice} maxLength={100} placeholder={`Opción ${index + 1}`} aria-label={`Opción ${index + 1}`} onChange={(event) => update({ choices: draft.choices.map((c, i) => (i === index ? event.target.value : c)) })} />
                {draft.choices.length > 2 ? <button type="button" className="ui-link" onClick={() => update({ choices: draft.choices.filter((_, i) => i !== index) })}>Quitar</button> : null}
              </span>
            ))}
            {draft.choices.length < GROUP_LIMITS.maxPollChoices ? <button type="button" className="ui-link" onClick={() => update({ choices: [...draft.choices, ""] })}>+ Otra opción</button> : null}
          </div>
        ) : null}
      </div>
      <label className="gr-send__switch">
        <input type="checkbox" checked={draft.mentionAll} onChange={(event) => update({ mentionAll: event.target.checked })} />
        <span><strong>Avisar a todos los miembros</strong>Les llega como mención aunque tengan el grupo silenciado, sin mostrar la lista de nombres.</span>
      </label>
      <div className="gr-send__block">
        <span className="gr-send__label">Cuándo</span>
        <div className="gr-send__when">
          <div className="gr-send__kinds">
            <button type="button" aria-selected={!draft.scheduledAt} onClick={() => update({ scheduledAt: null })}>Ahora</button>
            <button type="button" aria-selected={Boolean(draft.scheduledAt)} onClick={() => update({ scheduledAt: draft.scheduledAt ?? inAnHour() })}>Programar</button>
          </div>
          {draft.scheduledAt ? <input className="ui-input" type="datetime-local" value={draft.scheduledAt} aria-label="Fecha y hora" onChange={(event) => update({ scheduledAt: event.target.value || null })} /> : null}
        </div>
      </div>
    </>
  );
}

function inAnHour(): string {
  const at = new Date(Date.now() + 3_600_000);
  at.setMinutes(0, 0, 0);
  return new Date(at.getTime() - at.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}
