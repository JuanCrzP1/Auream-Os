import { vi } from "vitest";

// ---------------------------------------------------------------------------
// UN NAVEGADOR QUE RESPONDE COMO RESPONDERÍA EL DE VERDAD, SIN DECODIFICAR.
//
// jsdom no trae vídeo ni canvas: sin esto no hay forma de ejercitar el camino
// que va de elegir un archivo a ver su fotograma. Lo que se sustituye es SOLO
// el navegador —el elemento y el lienzo—, nunca el código del producto: para
// que aparezca un fotograma, `mediaThumbnails` tiene que hacer exactamente lo
// que haría en Chrome, en el mismo orden y con los mismos eventos.
//
// Vive aquí porque lo necesitan dos ficheros de pruebas y el andamiaje era
// idéntico en los dos. Lo que NO se comparte es qué comprueba cada uno: este
// helper monta el escenario y devuelve el guion para que cada prueba lo dirija.
//
// Lo que Chrome añade y aquí no cabe —decodificar de verdad, un códec no
// soportado, el tiempo que tarda— se midió aparte, en el navegador real.
// ---------------------------------------------------------------------------

/** Fotograma que devuelve el lienzo falso. */
export const FOTOGRAMA = "data:image/jpeg;base64,Zm90b2dyYW1h";

/** Cómo se comporta el navegador falso durante una prueba. */
export interface Guion {
  /** Evento con el que responde a que se le ponga una fuente. */
  responde: "loadeddata" | "error" | "nada";
  /** Tamaño que declara el video. `0x0` significa que no hay imagen. */
  ancho: number;
  alto: number;
  /** Si el salto al instante del fotograma llega a completarse. */
  salta: boolean;
  /** Duración declarada. Acota los instantes que se pueden pedir. */
  duracion: number;
  /**
   * Qué se ve en cada instante: `"liso"` es un color plano —una grabación que
   * no capturó nada—, `"penumbra"` varía tan poco que a la vista sigue siendo
   * negro —un fundido de entrada— y `"imagen"` tiene relieve de sobra.
   */
  loQueSeVe: (segundo: number) => "liso" | "penumbra" | "imagen";
}

/** Lo que el navegador falso hizo, para poder comprobarlo. */
export interface Registro {
  /** Fuentes que llegó a cargar. Delata trabajo de más. */
  readonly cargadas: string[];
  /** Instantes a los que se saltó. Delata cuántos se prueban. */
  readonly saltos: number[];
  /** Cuántos elementos de captura se retiraron de la página. */
  retirados: number;
  /** El `preload` que el producto pidió. */
  preload: string;
}

/**
 * Instala el navegador falso y devuelve con qué dirigirlo.
 *
 * Se llama desde `beforeEach`. Los espías se retiran con `vi.restoreAllMocks()`,
 * como cualquier otro.
 */
export function instalarNavegadorDeVideo(): { guion: Guion; registro: Registro } {
  const guion: Guion = {
    responde: "loadeddata",
    ancho: 1920,
    alto: 1080,
    salta: true,
    duracion: 12,
    loQueSeVe: () => "imagen"
  };
  const registro: Registro = { cargadas: [], saltos: [], retirados: 0, preload: "" };

  let instanteActual = 0;
  const crearOriginal = document.createElement;

  function videoFalso(): HTMLVideoElement {
    const el = crearOriginal.call(document, "video") as HTMLVideoElement;

    // Se anota si se retiró de la página: WebKit no decodifica un elemento
    // suelto, así que estar dentro y salir después importan las dos cosas.
    const quitar = el.remove.bind(el);
    Object.defineProperty(el, "remove", {
      value: () => {
        registro.retirados += 1;
        quitar();
      }
    });

    Object.defineProperty(el, "preload", {
      get: () => registro.preload,
      set: (v: string) => {
        registro.preload = v;
      }
    });
    Object.defineProperty(el, "videoWidth", { get: () => guion.ancho });
    Object.defineProperty(el, "videoHeight", { get: () => guion.alto });
    Object.defineProperty(el, "duration", { get: () => guion.duracion });

    let instante = 0;
    Object.defineProperty(el, "currentTime", {
      get: () => instante,
      set: (valor: number) => {
        instante = valor;
        instanteActual = valor;
        registro.saltos.push(valor);
        if (guion.salta) queueMicrotask(() => el.onseeked?.(new Event("seeked")));
      }
    });

    Object.defineProperty(el, "src", {
      get: () => "",
      set: (valor: string) => {
        registro.cargadas.push(valor);
        if (guion.responde === "nada") return;
        queueMicrotask(() => {
          if (guion.responde === "error") el.onerror?.(new Event("error"));
          else el.onloadeddata?.(new Event("loadeddata"));
        });
      },
      configurable: true
    });

    el.load = () => {};
    return el;
  }

  vi.spyOn(document, "createElement").mockImplementation(((etiqueta: string, ...resto: never[]) =>
    etiqueta === "video"
      ? videoFalso()
      : crearOriginal.call(document, etiqueta, ...resto)) as typeof document.createElement);

  // El lienzo: copiar el fotograma y poder mirarlo después. Lo que "copia"
  // depende del instante al que se haya saltado, que es lo que se ejercita.
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    drawImage: () => {},
    getImageData: (_x: number, _y: number, ancho: number, alto: number) => {
      const visto = guion.loQueSeVe(instanteActual);
      const data = new Uint8ClampedArray(ancho * alto * 4);
      for (let i = 0; i < data.length; i += 4) {
        const v = visto === "liso" ? 0 : visto === "penumbra" ? (i * 7) % 12 : (i * 7) % 256;
        data[i] = v;
        data[i + 1] = v;
        data[i + 2] = v;
        data[i + 3] = 255;
      }
      return { data, width: ancho, height: alto };
    }
  } as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue(FOTOGRAMA);

  return { guion, registro };
}

/**
 * Object URLs falsos, con una cuenta que NO se reinicia entre pruebas.
 *
 * La caché de fotogramas vive en el módulo y sobrevive a cada prueba, así que
 * dos enlaces llamados igual en pruebas distintas compartirían entrada y una
 * heredaría el resultado de la otra.
 *
 * Se espían los DOS MÉTODOS en vez de sustituir `URL` entera: reemplazarla por
 * un objeto plano deja sin constructor a `new URL(...)`, y con eso todo enlace
 * remoto pasaría por inválido sin que ninguna prueba lo dijera.
 */
let emitidos = 0;

export function instalarObjectUrls(): { readonly revocados: string[] } {
  const revocados: string[] = [];
  const conUrl = URL as unknown as Record<string, unknown>;
  conUrl.createObjectURL ??= () => "";
  conUrl.revokeObjectURL ??= () => {};

  vi.spyOn(URL, "createObjectURL").mockImplementation(
    (f) => `blob:falso/${(f as File).name}/${++emitidos}`
  );
  vi.spyOn(URL, "revokeObjectURL").mockImplementation((u) => void revocados.push(u));

  return { revocados };
}
