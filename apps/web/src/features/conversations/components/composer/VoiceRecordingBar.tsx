import { SendGlyph } from "../ChatGlyphs";
import { clock } from "./useVoiceRecorder";

// La nota de voz en el compositor: el botón para empezar y la barra mientras se graba.

/** Mientras se graba una nota de voz: descartar, el tiempo y enviar (como WhatsApp). */
export function VoiceRecordingBar({ seconds, onStop }: { readonly seconds: number; readonly onStop: (send: boolean) => void }) {
  return (
    <div className="chat-recording" role="status">
      <button type="button" className="chat-tool" aria-label="Descartar nota de voz" title="Descartar" onClick={() => onStop(false)}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>
      </button>
      <span className="chat-recording__dot" aria-hidden="true" />
      <span className="chat-recording__time">{clock(seconds)}</span>
      <span className="chat-recording__hint">Grabando nota de voz…</span>
      <button type="button" className="ios-send" aria-label="Enviar nota de voz" onClick={() => onStop(true)}>
        <SendGlyph />
      </button>
    </div>
  );
}

/** Sin nada escrito, el micrófono (grabar); con algo, enviar. */
export function SendOrRecordButton({ empty, busy, onSend, onRecord }: { readonly empty: boolean; readonly busy: boolean; readonly onSend: () => void; readonly onRecord: () => void }) {
  return empty ? (
    <button type="button" className="chat-tool chat-tool--mic" aria-label="Grabar nota de voz" title="Grabar nota de voz" disabled={busy} onClick={onRecord}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" /></svg>
    </button>
  ) : (
    <button type="button" className="ios-send" aria-label="Enviar" disabled={busy} onClick={onSend}>
      <SendGlyph />
    </button>
  );
}
