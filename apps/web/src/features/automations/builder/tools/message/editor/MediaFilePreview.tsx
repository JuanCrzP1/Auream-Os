import { useEffect, useRef, useState } from "react";
import type { MessageMediaKind } from "../types";
import { getItemIcon } from "./itemIcons";
import { useVistaPrevia } from "../useVistaPrevia";

interface MediaFilePreviewProps {
  readonly kind: MessageMediaKind;
  /** Object URL del archivo elegido. Lo crea y lo revoca `FileSource`. */
  readonly src: string;
  readonly name: string;
  /** Tamaño ya formateado. Solo se usa donde no hay nada que mostrar. */
  readonly size: string;
  /** Abrir de nuevo el MISMO selector de archivo del contenedor. */
  readonly onChange: () => void;
  readonly onRemove: () => void;
}

// ---------------------------------------------------------------------------
// Reproductor de audio
//
// PRIVADO Y SIN EXPORTAR. No es un `AudioPreview` ni una segunda entrada de
// preview: `MediaFilePreview` sigue siendo la única. Vive aparte por una razón
// concreta de React —los hooks no pueden ser condicionales—: si el estado de
// reproducción se declarara en `MediaFilePreview`, una imagen o un video
// arrastrarían también sus hooks y sus efectos sin usarlos nunca. Encapsulado
// aquí, solo existe cuando hay audio.
//
// NO CONOCE EL ARCHIVO. Recibe un `src` que otro creó y del que otro es dueño:
// el `File` y el Object URL son de `FileSource` y no se duplican aquí. Lo único
// que este componente posee es lo EFÍMERO de la reproducción —si suena, por
// dónde va y cuánto dura—, que muere con él y no se persiste en ningún sitio.
// ---------------------------------------------------------------------------

/** Cuántas barras dibuja la onda. */
const BARRAS = 44;

/** `mm:ss`. Un audio sin metadatos todavía no dura nada que se pueda decir. */
function reloj(segundos: number): string {
  if (!Number.isFinite(segundos) || segundos < 0) return "0:00";

  const total = Math.floor(segundos);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/**
 * Alturas de la onda, DERIVADAS DEL ARCHIVO.
 *
 * No es una waveform calculada del audio —eso exige decodificarlo entero— pero
 * tampoco es aleatoria: sale de un hash del nombre y el tamaño, así que un
 * mismo archivo dibuja siempre la misma onda y no parpadea entre renders.
 *
 * Lo que SÍ es real es el progreso: qué barras se pintan como reproducidas lo
 * decide `currentTime` del elemento, no una animación por su cuenta.
 */
function ondas(semilla: string): number[] {
  // FNV-1a: barato y bien repartido para una cadena corta.
  let h = 2166136261;
  for (let i = 0; i < semilla.length; i += 1) {
    h ^= semilla.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }

  const alturas: number[] = [];
  for (let i = 0; i < BARRAS; i += 1) {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    // Entre el 22% y el 100%: ninguna barra desaparece y la onda no se aplana.
    alturas.push(22 + (Math.abs(h) % 79));
  }

  return alturas;
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

function ReproductorAudio({ src, name, size }: { src: string; name: string; size: string }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [sonando, setSonando] = useState(false);
  const [transcurrido, setTranscurrido] = useState(0);
  const [duracion, setDuracion] = useState(0);

  // Al desmontarse —quitar el archivo, cerrar el editor, cambiar de archivo—
  // el audio deja de sonar. Sin esto, el elemento puede seguir reproduciendo
  // mientras el navegador no lo recoja.
  useEffect(() => {
    const el = audio.current;
    return () => el?.pause();
  }, []);

  const alternar = () => {
    const el = audio.current;
    if (!el) return;

    if (el.paused) {
      // `play()` devuelve una promesa que el navegador puede rechazar —políticas
      // de reproducción automática—. Se ignora el rechazo a propósito: quien
      // manda sobre `sonando` son los eventos del elemento, no esta llamada.
      void Promise.resolve(el.play()).catch(() => undefined);
      return;
    }

    el.pause();
  };

  /** Fracción reproducida. Sin duración conocida todavía no hay progreso. */
  const avance = duracion > 0 ? Math.min(transcurrido / duracion, 1) : 0;
  const barras = ondas(`${name}:${size}`);
  const sonadas = Math.round(avance * BARRAS);

  const saltarA = (razon: number) => {
    const el = audio.current;
    if (!el || duracion <= 0) return;

    const destino = Math.min(Math.max(razon, 0), 1) * duracion;
    el.currentTime = destino;
    setTranscurrido(destino);
  };

  return (
    <div className="media-audio">
      {/* El elemento es la fuente de verdad: `sonando` se escribe desde SUS
          eventos, no desde el botón. Así un fallo al arrancar, una pausa del
          sistema o el final del archivo dejan la interfaz donde toca sin que
          nada tenga que acordarse de sincronizarla.
          Los escuchadores van como props de React, que los añade y los retira
          con el componente: no hay `addEventListener` que limpiar a mano. */}
      <audio
        ref={audio}
        src={src}
        preload="metadata"
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration;
          setDuracion(Number.isFinite(d) ? d : 0);
        }}
        onTimeUpdate={(e) => setTranscurrido(e.currentTarget.currentTime)}
        onPlay={() => setSonando(true)}
        onPause={() => setSonando(false)}
        onEnded={(e) => {
          // Volver al principio deja el reproductor listo para sonar otra vez,
          // que es lo que se espera al pulsar Play después de terminar.
          setSonando(false);
          setTranscurrido(0);
          e.currentTarget.currentTime = 0;
        }}
      />

      <button
        type="button"
        className="media-audio__play nodrag"
        onClick={alternar}
        aria-label={sonando ? `Pausar ${name}` : `Reproducir ${name}`}
      >
        {sonando ? <PauseIcon /> : <PlayIcon />}
      </button>

      {/* La onda ES el control de posición, no un adorno al lado de otro. */}
      <button
        type="button"
        className="media-audio__wave nodrag"
        role="slider"
        aria-label={`Posición de ${name}`}
        aria-valuemin={0}
        aria-valuemax={Math.round(duracion)}
        aria-valuenow={Math.round(transcurrido)}
        aria-valuetext={`${reloj(transcurrido)} de ${reloj(duracion)}`}
        onClick={(event) => {
          const caja = event.currentTarget.getBoundingClientRect();
          if (caja.width <= 0) return;
          saltarA((event.clientX - caja.left) / caja.width);
        }}
        onKeyDown={(event) => {
          if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
          event.preventDefault();
          const paso = event.key === "ArrowRight" ? 5 : -5;
          if (duracion > 0) saltarA((transcurrido + paso) / duracion);
        }}
      >
        {barras.map((alto, i) => (
          <span
            key={i}
            className={`media-audio__bar${i < sonadas ? " media-audio__bar--sonada" : ""}`}
            style={{ height: `${alto}%` }}
          />
        ))}
      </button>

      <span className="media-audio__time">
        {reloj(transcurrido)} / {reloj(duracion)}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Video del editor
//
// PRIVADO Y SIN EXPORTAR, por la misma razón que el reproductor de audio: es lo
// único de aquí que necesita un hook, y declarándolo en `MediaFilePreview` una
// imagen o un archivo lo arrastrarían sin usarlo jamás.
//
// EL DEFECTO QUE CORRIGE: antes esto era un `<video>` pelado con
// `preload="metadata"` y un comentario que afirmaba que eso «trae el primer
// fotograma». No lo trae —`metadata` promete duración y dimensiones, nada
// más—, así que hasta pulsar Play solo se veía el fondo de la caja. El usuario
// tenía que reproducir el video para descubrir cuál había elegido.
// ---------------------------------------------------------------------------

/**
 * El video, con una imagen suya visible desde el primer momento.
 *
 * EL FOTOGRAMA NO SE SACA AQUÍ: se pide al mismo sitio que lo pide el nodo del
 * lienzo, así que el editor y el lienzo enseñan LA MISMA imagen del mismo
 * archivo, sacada una sola vez y guardada una sola vez. No hay un segundo
 * sistema de miniaturas ni un segundo camino que mantener.
 *
 * SE USA `poster` Y NO UNA IMAGEN SUPERPUESTA. Es el mecanismo que el navegador
 * ya tiene para esto: aparece antes de reproducir, lo retira él solo en cuanto
 * empieza el video, y al pausar deja a la vista el fotograma real donde se
 * paró. Una capa encima habría exigido escribir a mano esas tres reglas —y
 * además taparía los controles mientras estuviera puesta—.
 *
 * `poster` es una URL, así que cambiar de archivo lo cambia sin más; no queda
 * nada que limpiar cuando el fotograma anterior deja de valer.
 */
function VistaPreviaVideo({ src, name }: { src: string; name: string }) {
  const fotograma = useVistaPrevia(src, true);

  return (
    <video
      className="media-file__media"
      src={src}
      // Sin fotograma todavía —o sin ninguno posible— se omite el atributo en
      // vez de ponerlo vacío: un `poster=""` es una imagen rota para el
      // navegador, no la ausencia de imagen.
      poster={fotograma ?? undefined}
      aria-label={name}
      controls
      // Las dimensiones reales llegan con los metadatos, y son lo que el layout
      // necesita para dar al video el mayor tamaño que le cabe. El fotograma ya
      // no depende de esto: viene por su cuenta.
      preload="metadata"
    />
  );
}

/**
 * Lo que se ve dentro de la zona de carga cuando ya hay un archivo.
 *
 * NO ES OTRA CAJA. Se monta dentro de la misma `.media-file` que pinta el
 * estado vacío, con su mismo alto, su mismo borde y su mismo radio: lo único
 * que cambia entre vacío y elegido es este contenido. Por eso aquí no hay
 * medidas, ni superficie, ni padding propio — todo eso pertenece al contenedor,
 * que es el único que puede garantizar que el editor no salte.
 *
 * DOS HUECOS, NO UNO: el medio y las acciones son hermanos. Las acciones ocupan
 * un ancho compacto y estable a la derecha, y el medio se queda con TODO el
 * resto —incluida la altura entera de la caja, que antes le robaba la fila de
 * botones—. Es lo que permite que la foto se vea al mayor tamaño que su
 * proporción admite sin recortarla ni superponerle nada encima.
 *
 * SIN ESTADO PROPIO, a propósito: lo único que necesita estado es el
 * reproductor de audio, y por eso vive encapsulado en su componente privado en
 * vez de aquí. Imagen, Video y Archivo no arrastran ni un hook que no usen.
 *
 * Cada tipo se distingue por una línea y nada más: la etiqueta con la que se
 * pinta. Ahí entraría un tipo nuevo, sin tocar el contenedor ni sus medidas.
 */
export function MediaFilePreview({
  kind,
  src,
  name,
  size,
  onChange,
  onRemove
}: MediaFilePreviewProps) {
  const Icon = getItemIcon(kind);

  return (
    <>
      <div className="media-file__preview">
        {src === "" ? (
          // Sin fuente que pintar: se identifica por nombre. Es el caso de un
          // archivo elegido antes de recargar, y el de los tipos que todavía no
          // tienen forma propia de mostrarse.
          <span className="media-file__named">
            <span className="media-file__badge" aria-hidden="true">
              <Icon />
            </span>
            <span className="media-file__meta">
              <span className="media-file__name">{name}</span>
              <span className="media-file__size">{size}</span>
            </span>
          </span>
        ) : kind === "image" ? (
          <img className="media-file__media" src={src} alt={name} />
        ) : kind === "video" ? (
          <VistaPreviaVideo src={src} name={name} />
        ) : kind === "audio" ? (
          // `key` por archivo: cambiar de audio MONTA otro reproductor en vez
          // de reutilizar el que había. Es React quien reinicia entonces todo
          // su estado —posición, duración, si sonaba— y quien detiene el
          // anterior, sin un solo efecto de sincronización escrito a mano.
          <ReproductorAudio key={src} src={src} name={name} size={size} />
        ) : (
          // Archivo no tiene forma propia de mostrarse: se identifica por
          // nombre, dentro del mismo hueco que ocuparía un medio.
          <span className="media-file__named">
            <span className="media-file__badge" aria-hidden="true">
              <Icon />
            </span>
            <span className="media-file__meta">
              <span className="media-file__name">{name}</span>
              <span className="media-file__size">{size}</span>
            </span>
          </span>
        )}
      </div>

      <span className="media-file__actions">
        <button type="button" className="media-file__control nodrag" onClick={onChange}>
          Cambiar
        </button>
        <button
          type="button"
          className="media-file__control media-file__control--clear nodrag"
          onClick={onRemove}
        >
          Quitar
        </button>
      </span>
    </>
  );
}
