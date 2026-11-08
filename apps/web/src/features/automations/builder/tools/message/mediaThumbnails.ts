// ---------------------------------------------------------------------------
// Miniatura de un medio para el nodo cerrado y el poster del editor.
//
// Imagen: su fuente ya es pintable. Video: hay que decodificar y copiar un
// fotograma (asíncrono, puede fallar, se cachea). Un `<video>` de trabajo por
// captura, ancho tope pequeño y tiempo máximo. Cualquier fallo (códec, CORS,
// canvas contaminado) termina en `null` = «usa el icono»: nunca rompe el lienzo.
// ---------------------------------------------------------------------------

import { sessionSources, subscribeToSession } from "./mediaSourceSession";

/** Ancho del fotograma capturado (el preview lo muestra a 38 px). */
const THUMBNAIL_WIDTH = 96;

/** Tiempo máximo de espera por un video. */
const TIMEOUT_MS = 4000;

/**
 * Instantes a probar, en orden. Muchos videos empiezan en negro (fundido,
 * claqueta): el 0.1 s solo no basta. La fracción de la duración, al final,
 * para que un video largo no se quede en su cabecera.
 */
const INSTANTS: ReadonlyArray<number | "tenth"> = [0.1, 1, 3, "tenth"];

/**
 * Contraste mínimo (0–255) para aceptar un fotograma como último recurso.
 * Medido: fundido a 0.1 s = 12, negro = 0 (rechazar); escena nocturna = 137,
 * video normal = 242 (aceptar). Se mide contraste, no brillo, para no
 * descartar escenas oscuras legítimas.
 */
const MIN_CONTRAST = 40;

/**
 * Contraste a partir del cual se deja de buscar. Quedarse con el primero que
 * pasaba el mínimo dejaba un 42 (negro a la vista) cuando un segundo después
 * había un 228. Un video normal lo supera al primer salto.
 */
const GOOD_CONTRAST = 120;

const cache = new Map<string, string>();
const inFlight = new Set<string>();
const failed = new Set<string>();

/**
 * Fuentes olvidadas mientras se capturaban (la captura no se puede cancelar):
 * su resultado tardío se descarta en vez de dejar una entrada muerta en caché.
 */
const abandoned = new Set<string>();

const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

/** Suscripción para `useSyncExternalStore`: avisa al llegar una miniatura. */
export function subscribeToThumbnails(listener: () => void): () => void {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

/** Segundo concreto de un instante en ESTE video, o `null` si cae tras el final. */
function resolveInstant(when: number | "tenth", duration: number): number | null {
  if (!Number.isFinite(duration) || duration <= 0) {
    return typeof when === "number" ? when : null;
  }

  const second = when === "tenth" ? duration / 10 : when;
  return second < duration ? second : null;
}

/** Cuánto varía la luz de lo dibujado (0–255), muestreando 1 de cada 100 píxeles. */
function contrastOf(context: CanvasRenderingContext2D, canvas: HTMLCanvasElement): number {
  // Lanza si el canvas quedó contaminado por CORS; lo recoge quien llama.
  const { data } = context.getImageData(0, 0, canvas.width, canvas.height);

  let min = 255;
  let max = 0;

  for (let i = 0; i < data.length; i += 400) {
    const light = (data[i] + data[i + 1] + data[i + 2]) / 3;
    if (light < min) min = light;
    if (light > max) max = light;
  }

  return max - min;
}

async function captureFrame(src: string): Promise<string | null> {
  if (typeof document === "undefined") return null;

  const video = document.createElement("video");
  // `auto`, no `metadata`: WebKit con `metadata` se queda en readyState 1 y
  // `loadeddata` nunca llega.
  video.preload = "auto";
  video.muted = true;
  video.playsInline = true;

  // Debe estar EN la página: WebKit no decodifica un `<video>` fuera del
  // documento. Se mueve fuera de la vista (no `display:none`, que reproduce el
  // problema) y se retira pase lo que pase.
  video.setAttribute("aria-hidden", "true");
  video.style.cssText = "position:fixed;left:-10000px;top:0;width:2px;height:2px;opacity:0;pointer-events:none";
  document.body.appendChild(video);
  // Sin esto, un video de otro dominio contamina el canvas.
  if (!src.startsWith("blob:")) video.crossOrigin = "anonymous";

  try {
    // Esperar a `loadeddata` (hay fotograma), no a `loadedmetadata` (solo ficha).
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("timeout")), TIMEOUT_MS);
      video.onloadeddata = () => {
        clearTimeout(timer);
        resolve();
      };
      video.onerror = () => {
        clearTimeout(timer);
        reject(new Error("load"));
      };
      video.src = src;
    });

    const width = video.videoWidth;
    const height = video.videoHeight;
    if (!width || !height) return null;

    const canvas = document.createElement("canvas");
    canvas.width = Math.min(THUMBNAIL_WIDTH, width);
    canvas.height = Math.round((canvas.width / width) * height);

    const context = canvas.getContext("2d");
    if (!context) return null;

    let best: string | null = null;
    let bestContrast = 0;

    for (const when of INSTANTS) {
      const instant = resolveInstant(when, video.duration);
      if (instant === null) continue;

      await new Promise<void>((resolve) => {
        // Si el salto no ocurre, se sigue con el fotograma que haya.
        const timer = setTimeout(resolve, TIMEOUT_MS / 4);
        video.onseeked = () => {
          clearTimeout(timer);
          resolve();
        };
        video.currentTime = instant;
      });

      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const contrast = contrastOf(context, canvas);
      if (contrast <= bestContrast) continue;

      bestContrast = contrast;
      best = canvas.toDataURL("image/jpeg", 0.6);
      if (contrast >= GOOD_CONTRAST) return best;
    }

    // Un rectángulo liso parece un fallo; el icono dice la verdad.
    return bestContrast > MIN_CONTRAST ? best : null;
  } catch {
    return null;
  } finally {
    video.onloadeddata = null;
    video.onerror = null;
    video.onseeked = null;
    video.removeAttribute("src");
    video.load();
    video.remove();
  }
}

/**
 * Lectura pura para `useSyncExternalStore`: no arranca trabajo y devuelve el
 * mismo valor mientras nada cambie. La captura la arranca `prefetchThumbnail`.
 */
export function cachedThumbnail(src: string, isVideo: boolean): string | null {
  if (!src) return null;
  if (!isVideo) return src;

  return cache.get(src) ?? null;
}

/**
 * Arranca la captura en cuanto hay bytes (al elegir el archivo), para que el
 * nodo aparezca con su fotograma al guardar. Idempotente.
 */
export function prefetchThumbnail(src: string): void {
  if (!src || cache.has(src) || inFlight.has(src) || failed.has(src)) return;

  inFlight.add(src);
  void captureFrame(src).then((frame) => {
    inFlight.delete(src);

    if (abandoned.delete(src)) return;

    if (frame) {
      cache.set(src, frame);
      notify();
      return;
    }

    // No reintentar en cada render; `forgetThumbnail` lo limpia si la fuente cambia.
    failed.add(src);
  });
}

/** Olvida todo lo asociado a una fuente que dejó de existir. */
export function forgetThumbnail(src: string): void {
  cache.delete(src);
  failed.delete(src);

  // Una captura viva traería el fotograma de algo que ya no existe: se marca.
  if (inFlight.delete(src)) abandoned.add(src);
}

// ---------------------------------------------------------------------------
// Caducidad: cuando un archivo deja la sesión, su Object URL se revoca y su
// fotograma ya no representa nada. Lo olvida este módulo, que es quien lo
// guardó (la sesión solo anuncia cambios). Solo se olvida lo que vino de la
// sesión: los enlaces remotos no caducan con ella.
// ---------------------------------------------------------------------------

let fromSession: ReadonlySet<string> = new Set();

subscribeToSession(() => {
  const now = new Set(sessionSources().map(({ url }) => url));

  for (const url of fromSession) {
    if (!now.has(url)) forgetThumbnail(url);
  }

  fromSession = now;
});
