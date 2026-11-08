import { useEffect, useRef, useState, type ComponentType } from "react";
import type { MessageMediaKind } from "../types";
import { getItemIcon } from "./itemIcons";
import { usePreview } from "../usePreview";

interface MediaFilePreviewProps {
  readonly kind: MessageMediaKind;
  /** Object URL del archivo elegido (de la sesión), o `""` si ya no hay bytes. */
  readonly src: string;
  readonly name: string;
  /** Texto secundario, solo donde no hay nada que mostrar. */
  readonly size: string;
  /** Reabre el MISMO selector de archivo del contenedor. */
  readonly onChange: () => void;
  readonly onRemove: () => void;
}

// ---------------------------------------------------------------------------
// Reproductor de audio. Privado: es lo único con estado, y aislarlo evita que
// imagen, video y archivo arrastren hooks que no usan. Solo posee lo efímero
// de la reproducción; el archivo es de la sesión.
// ---------------------------------------------------------------------------

const BAR_COUNT = 44;

/** `m:ss`. */
function formatClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";

  const total = Math.floor(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/**
 * Alturas de la onda, deterministas por archivo (hash FNV-1a + xorshift del
 * nombre y tamaño): no es una waveform real, pero no parpadea entre renders.
 * El progreso sí es real (`currentTime`).
 */
function waveHeights(seed: string): number[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }

  const heights: number[] = [];
  for (let i = 0; i < BAR_COUNT; i += 1) {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    // Entre 22 % y 100 %: ninguna barra desaparece.
    heights.push(22 + (Math.abs(h) % 79));
  }

  return heights;
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path d="M6.5 4.2a.8.8 0 0 1 1.22-.68l8 5.8a.8.8 0 0 1 0 1.36l-8 5.8A.8.8 0 0 1 6.5 15.8z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <rect x="5.4" y="4" width="3.4" height="12" rx="1.1" />
      <rect x="11.2" y="4" width="3.4" height="12" rx="1.1" />
    </svg>
  );
}

function AudioPlayer({ src, name, size }: { src: string; name: string; size: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [duration, setDuration] = useState(0);

  // Deja de sonar al desmontarse (quitar, cerrar el editor, cambiar de archivo).
  useEffect(() => {
    const element = audioRef.current;
    return () => element?.pause();
  }, []);

  const toggle = () => {
    const element = audioRef.current;
    if (!element) return;

    if (element.paused) {
      // El navegador puede rechazar `play()`; manda el estado de los eventos.
      void Promise.resolve(element.play()).catch(() => undefined);
      return;
    }

    element.pause();
  };

  const progress = duration > 0 ? Math.min(elapsed / duration, 1) : 0;
  const bars = waveHeights(`${name}:${size}`);
  const playedBars = Math.round(progress * BAR_COUNT);

  const seekTo = (ratio: number) => {
    const element = audioRef.current;
    if (!element || duration <= 0) return;

    const target = Math.min(Math.max(ratio, 0), 1) * duration;
    element.currentTime = target;
    setElapsed(target);
  };

  return (
    <div className="media-audio">
      {/* El elemento es la fuente de verdad: el estado se escribe desde sus eventos. */}
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onLoadedMetadata={(event) => {
          const value = event.currentTarget.duration;
          setDuration(Number.isFinite(value) ? value : 0);
        }}
        onTimeUpdate={(event) => setElapsed(event.currentTarget.currentTime)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={(event) => {
          setPlaying(false);
          setElapsed(0);
          event.currentTarget.currentTime = 0;
        }}
      />

      <button
        type="button"
        className="media-audio__play nodrag"
        onClick={toggle}
        aria-label={playing ? `Pausar ${name}` : `Reproducir ${name}`}
      >
        {playing ? <PauseIcon /> : <PlayIcon />}
      </button>

      {/* La onda ES el control de posición. */}
      <button
        type="button"
        className="media-audio__wave nodrag"
        role="slider"
        aria-label={`Posición de ${name}`}
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        aria-valuenow={Math.round(elapsed)}
        aria-valuetext={`${formatClock(elapsed)} de ${formatClock(duration)}`}
        onClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          if (rect.width <= 0) return;
          seekTo((event.clientX - rect.left) / rect.width);
        }}
        onKeyDown={(event) => {
          if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
          event.preventDefault();
          const step = event.key === "ArrowRight" ? 5 : -5;
          if (duration > 0) seekTo((elapsed + step) / duration);
        }}
      >
        {bars.map((height, i) => (
          <span
            key={i}
            className={`media-audio__bar${i < playedBars ? " media-audio__bar--played" : ""}`}
            style={{ height: `${height}%` }}
          />
        ))}
      </button>

      <span className="media-audio__time">
        {formatClock(elapsed)} / {formatClock(duration)}
      </span>
    </div>
  );
}

/**
 * Video con `poster` desde el primer momento. El fotograma es el mismo que usa
 * el nodo del lienzo (una sola captura). `poster` y no una capa encima: el
 * navegador ya lo retira al reproducir.
 */
function VideoPreview({ src, name }: { src: string; name: string }) {
  const frame = usePreview(src, true);

  return (
    <video
      className="media-file__media"
      src={src}
      // Sin fotograma se omite: `poster=""` es una imagen rota.
      poster={frame ?? undefined}
      aria-label={name}
      controls
      preload="metadata"
    />
  );
}

/** Identificación por nombre: archivo genérico, o bytes perdidos tras recargar. */
function NamedFile({ Icon, name, size }: { Icon: ComponentType; name: string; size: string }) {
  return (
    <span className="media-file__named">
      <span className="media-file__badge" aria-hidden="true">
        <Icon />
      </span>
      <span className="media-file__meta">
        <span className="media-file__name">{name}</span>
        <span className="media-file__size">{size}</span>
      </span>
    </span>
  );
}

/**
 * Contenido de la zona de carga cuando ya hay archivo. No es otra caja: vive
 * dentro de `.media-file`, que garantiza el alto. Medio a la izquierda (todo el
 * espacio) y acciones compactas a la derecha.
 */
export function MediaFilePreview({ kind, src, name, size, onChange, onRemove }: MediaFilePreviewProps) {
  const Icon = getItemIcon(kind);

  return (
    <>
      <div className="media-file__preview">
        {src === "" || kind === "file" ? (
          <NamedFile Icon={Icon} name={name} size={size} />
        ) : kind === "image" ? (
          <img className="media-file__media" src={src} alt={name} />
        ) : kind === "video" ? (
          <VideoPreview src={src} name={name} />
        ) : (
          // `key` por archivo: cambiar de audio monta otro reproductor y React
          // reinicia su estado y detiene el anterior.
          <AudioPlayer key={src} src={src} name={name} size={size} />
        )}
      </div>

      <span className="media-file__actions">
        <button type="button" className="media-file__control nodrag" onClick={onChange}>
          Cambiar
        </button>
        <button type="button" className="media-file__control media-file__control--clear nodrag" onClick={onRemove}>
          Quitar
        </button>
      </span>
    </>
  );
}
