import { useCallback, useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// Grabar una nota de voz en el navegador. WhatsApp acepta ogg (opus) o mp4
// (aac): se usa el primero que el navegador sepa grabar (Firefox: ogg;
// Chrome y Safari: mp4). Si no sabe ninguno, se avisa en vez de grabar algo
// que WhatsApp rechazaría.
// ---------------------------------------------------------------------------

const FORMATS: ReadonlyArray<{ readonly mime: string; readonly type: string; readonly extension: string }> = [
  { mime: "audio/ogg;codecs=opus", type: "audio/ogg", extension: "ogg" },
  { mime: "audio/mp4;codecs=mp4a.40.2", type: "audio/mp4", extension: "m4a" },
  { mime: "audio/mp4", type: "audio/mp4", extension: "m4a" }
];

/** Tope de una nota de voz (como WhatsApp, holgado). */
export const MAX_VOICE_SECONDS = 15 * 60;

export type RecorderState = "idle" | "recording";

function pickFormat() {
  if (typeof MediaRecorder === "undefined") return null;
  return FORMATS.find((format) => MediaRecorder.isTypeSupported?.(format.mime)) ?? null;
}

export function useVoiceRecorder(onDone: (file: File) => void, onError: (message: string) => void) {
  const [state, setState] = useState<RecorderState>("idle");
  const [seconds, setSeconds] = useState(0);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const keep = useRef(false);
  const timer = useRef<number | undefined>(undefined);

  const release = useCallback(() => {
    window.clearInterval(timer.current);
    recorder.current?.stream.getTracks().forEach((track) => track.stop());
    recorder.current = null;
    setState("idle");
    setSeconds(0);
  }, []);

  const start = useCallback(async () => {
    const format = pickFormat();
    if (!format || !navigator.mediaDevices?.getUserMedia) {
      onError("Este navegador no puede grabar notas de voz que WhatsApp acepte. Prueba con Chrome, Safari o Firefox actualizados.");
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      onError("No hay permiso para usar el micrófono. Actívalo en el candado de la barra de direcciones.");
      return;
    }
    const instance = new MediaRecorder(stream, { mimeType: format.mime });
    chunks.current = [];
    keep.current = false;
    instance.ondataavailable = (event) => event.data.size > 0 && chunks.current.push(event.data);
    instance.onstop = () => {
      const blob = new Blob(chunks.current, { type: format.type });
      release();
      if (keep.current && blob.size > 0) onDone(new File([blob], `nota-de-voz-${Date.now()}.${format.extension}`, { type: format.type }));
    };
    recorder.current = instance;
    instance.start(250);
    setState("recording");
    const startedAt = Date.now();
    timer.current = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000);
      setSeconds(elapsed);
      if (elapsed >= MAX_VOICE_SECONDS) {
        keep.current = true;
        instance.stop();
      }
    }, 250);
  }, [onDone, onError, release]);

  /** Termina y entrega el audio (`send`) o lo descarta. */
  const stop = useCallback((send: boolean) => {
    keep.current = send;
    if (recorder.current?.state === "recording") recorder.current.stop();
    else release();
  }, [release]);

  useEffect(() => () => {
    keep.current = false;
    if (recorder.current?.state === "recording") recorder.current.stop();
    window.clearInterval(timer.current);
  }, []);

  return { state, seconds, start, stop };
}

export const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
