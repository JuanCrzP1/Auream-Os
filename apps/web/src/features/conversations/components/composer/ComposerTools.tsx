import { useRef } from "react";

/** Los botones a la izquierda del cuadro de texto: respuestas rápidas, adjuntar y emojis. */
export function ComposerTools({
  popover,
  onQuick,
  onEmoji,
  onFiles
}: {
  readonly popover: "quick" | "emoji" | null;
  readonly onQuick: () => void;
  readonly onEmoji: () => void;
  readonly onFiles: (files: File[]) => void;
}) {
  const files = useRef<HTMLInputElement>(null);
  return (
    <div className="chat-composer__tools">
      <button type="button" data-quick-toggle className={`chat-tool${popover === "quick" ? " is-active" : ""}`} aria-label="Respuestas rápidas" aria-expanded={popover === "quick"} title="Respuestas rápidas (/)" onClick={onQuick}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 3 5 13.5h6L10 21l8-10.5h-6L13 3Z" /></svg>
      </button>
      <button type="button" className="chat-tool" aria-label="Adjuntar archivo" title="Adjuntar foto, video, audio o documento" onClick={() => files.current?.click()}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m20 11.5-7.8 7.8a5 5 0 0 1-7.1-7.1l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7l-8.5 8.5a1.7 1.7 0 0 1-2.4-2.4l7.8-7.8" /></svg>
      </button>
      <input
        ref={files}
        type="file"
        hidden
        multiple
        accept="image/jpeg,image/png,video/mp4,video/3gpp,audio/*,application/pdf,text/plain,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
        onChange={(event) => {
          onFiles([...(event.target.files ?? [])]);
          event.target.value = "";
        }}
      />
      <button type="button" data-emoji-toggle className={`chat-tool chat-tool--emoji${popover === "emoji" ? " is-active" : ""}`} aria-label="Emojis" aria-expanded={popover === "emoji"} title="Emojis" onClick={onEmoji}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" /><path d="M8.5 14s1.3 2 3.5 2 3.5-2 3.5-2M9.5 9.8h0M14.5 9.8h0" /></svg>
      </button>
    </div>
  );
}
