import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MessageCompactBody } from "@features/automations/builder/tools/message/MessageCompactBody";
import {
  adjuntarArchivo,
  enlaceDeSesion,
  soltarArchivo
} from "@features/automations/builder/tools/message/mediaSourceSession";
import { FOTOGRAMA, instalarNavegadorDeVideo, instalarObjectUrls, type Guion, type Registro } from "../helpers/navegadorDeVideo";
import { olvidarMiniatura } from "@features/automations/builder/tools/message/mediaThumbnails";
import { useVistaPrevia } from "@features/automations/builder/tools/message/useVistaPrevia";

// ---------------------------------------------------------------------------
// EL VIDEO QUE EL USUARIO ELIGE TERMINA ENSEÑANDO SU FOTOGRAMA EN EL NODO.
//
// Estas pruebas NO comprueban el algoritmo de captura por su cuenta: entran por
// donde entra el producto —se adjunta un archivo y se pinta el preview del nodo
// cerrado— y miran lo único que importa, que es lo que acaba en el `<img>`.
//
// Un `<video>` de verdad no existe en estas pruebas: jsdom no decodifica nada.
// Lo que se sustituye es SOLO el navegador —el elemento y el canvas—, nunca el
// código del producto. Por eso el doble de abajo no simplifica el camino: para
// que el fotograma aparezca, `mediaThumbnails` tiene que hacer exactamente lo
// que haría en Chrome, en el mismo orden y con los mismos eventos.
//
// Lo que Chrome añade y aquí no cabe —decodificar de verdad, un códec no
// soportado, el tiempo que tarda— se midió aparte, en el navegador real.
// ---------------------------------------------------------------------------


let guion: Guion;
let registro: Registro;

/**
 * Un consumidor cualquiera del preview.
 *
 * Representa lo que hace el editor al montar su vista previa: pedir la imagen
 * de una fuente. No es un doble del editor —no imita su marcado— sino la única
 * puerta por la que se pide un fotograma.
 */
function PideVistaPrevia({ fuente }: { fuente: string }) {
  useVistaPrevia(fuente, true);
  return null;
}

const medio = (kind: string, extra: Record<string, unknown> = {}) => ({
  id: kind,
  kind,
  url: "",
  fileName: "",
  caption: "",
  sendOnce: false,
  ...extra
});

const pintar = (items: ReadonlyArray<Record<string, unknown>>) =>
  render(<MessageCompactBody draft={{ config: { items } }} />);

const miniatura = () => document.querySelector<HTMLImageElement>(".flow-node__block-thumb");
const iconos = () => document.querySelectorAll(".flow-node__block-badge").length;

/** Adjunta un archivo al bloque, como haría el editor. */
function elegirArchivo(itemId: string, tipo: string, nombre = "grabacion.mp4") {
  return adjuntarArchivo(itemId, new File(["bytes"], nombre, { type: tipo }));
}

beforeEach(() => {
  ({ guion, registro } = instalarNavegadorDeVideo());
  instalarObjectUrls();
});

afterEach(() => {
  cleanup();
  for (const id of ["video", "image", "audio", "file", "a", "b"]) soltarArchivo(id);
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("un video elegido del dispositivo acaba enseñando su fotograma", () => {
  it("el nodo cerrado pasa del icono al fotograma real", async () => {
    elegirArchivo("video", "video/mp4");
    pintar([medio("video", { fileName: "grabacion.mp4" })]);

    // Antes de que el fotograma exista se enseña el icono: esperar no bloquea.
    expect(iconos()).toBe(1);

    await waitFor(() => expect(miniatura()?.src).toBe(FOTOGRAMA));
    expect(iconos()).toBe(0);
  });

  it("el fotograma sale del archivo de la sesión, no de un enlace inventado", async () => {
    const enlace = elegirArchivo("video", "video/mp4");

    pintar([medio("video", { fileName: "grabacion.mp4" })]);
    await waitFor(() => expect(miniatura()).not.toBeNull());

    expect(registro.cargadas).toContain(enlace);
  });

  it("el nodo llega al fotograma ya hecho si el editor lo pidió antes", async () => {
    // Es la diferencia entre ver el fotograma al cerrar el editor y quedarse
    // mirando el icono casi un segundo. Medido en Chrome: 750ms contra 50ms.
    //
    // Quien lo pide primero es el preview del EDITOR, que se monta en cuanto se
    // elige el archivo. Aquí se representa con el mismo hook que usa: la caché
    // es común, así que el nodo no vuelve a capturar nada.
    const enlace = elegirArchivo("video", "video/mp4");
    render(<PideVistaPrevia fuente={enlace} />);
    await waitFor(() => expect(registro.cargadas).toContain(enlace));

    pintar([medio("video", { fileName: "grabacion.mp4" })]);

    // Ya estaba hecho: el primer render del nodo cerrado ya trae la imagen, y
    // sin una segunda captura.
    await waitFor(() => expect(miniatura()?.src).toBe(FOTOGRAMA));
    expect(registro.cargadas).toHaveLength(1);
  });

  it("un audio no arranca ninguna captura: no hay fotograma que sacar", async () => {
    elegirArchivo("audio", "audio/mpeg", "voz.mp3");
    await new Promise((r) => setTimeout(r, 0));

    expect(registro.cargadas).toEqual([]);
  });

  it("el fotograma se saca una sola vez aunque el nodo se pinte muchas", async () => {
    elegirArchivo("video", "video/mp4");
    const items = [medio("video", { fileName: "grabacion.mp4" })];

    const { rerender } = pintar(items);
    await waitFor(() => expect(miniatura()).not.toBeNull());
    for (let i = 0; i < 5; i += 1) rerender(<MessageCompactBody draft={{ config: { items } }} />);

    expect(registro.cargadas).toHaveLength(1);
  });

  it("dos videos distintos se resuelven cada uno por su lado", async () => {
    elegirArchivo("a", "video/mp4", "uno.mp4");
    elegirArchivo("b", "video/mp4", "dos.mp4");

    pintar([
      { ...medio("video"), id: "a", fileName: "uno.mp4" },
      { ...medio("video"), id: "b", fileName: "dos.mp4" }
    ]);

    await waitFor(() =>
      expect(document.querySelectorAll(".flow-node__block-thumb")).toHaveLength(2)
    );
    expect(new Set(registro.cargadas).size).toBe(2);
  });
});

describe("cuando no se puede sacar fotograma, el icono es la respuesta correcta", () => {
  it("un códec que el navegador no decodifica deja el icono", async () => {
    // Es el caso real de un video HEVC: Chrome contesta `error` y no hay imagen
    // posible. Comprobado en el navegador: `canPlayType('hvc1')` es "".
    Object.assign(guion, { responde: "error" });
    elegirArchivo("video", "video/mp4");

    pintar([medio("video", { fileName: "grabacion.mp4" })]);

    await new Promise((r) => setTimeout(r, 0));
    expect(iconos()).toBe(1);
    expect(miniatura()).toBeNull();
  });

  it("un video sin dimensiones no produce una imagen vacía", async () => {
    Object.assign(guion, { ancho: 0, alto: 0 });
    elegirArchivo("video", "video/mp4");

    pintar([medio("video", { fileName: "grabacion.mp4" })]);

    await new Promise((r) => setTimeout(r, 0));
    expect(miniatura()).toBeNull();
    expect(iconos()).toBe(1);
  });

  it("un fallo no se reintenta en cada render", async () => {
    Object.assign(guion, { responde: "error" });
    elegirArchivo("video", "video/mp4");
    const items = [medio("video", { fileName: "grabacion.mp4" })];

    const { rerender } = pintar(items);
    await new Promise((r) => setTimeout(r, 0));
    for (let i = 0; i < 5; i += 1) rerender(<MessageCompactBody draft={{ config: { items } }} />);

    expect(registro.cargadas).toHaveLength(1);
  });

  it("tras recargar no hay bytes, y el bloque se representa con su icono", () => {
    // La elección sobrevive en `fileName`; los bytes, no. No se inventa una
    // vista previa de algo que ya no está.
    pintar([medio("video", { fileName: "grabacion.mp4" })]);

    expect(enlaceDeSesion("video")).toBeNull();
    expect(miniatura()).toBeNull();
    expect(iconos()).toBe(1);
  });
});

describe("el lienzo no monta medios ni retiene recursos", () => {
  it("no queda ningún elemento de video en la página", async () => {
    elegirArchivo("video", "video/mp4");
    pintar([medio("video", { fileName: "grabacion.mp4" })]);
    await waitFor(() => expect(miniatura()).not.toBeNull());

    expect(document.querySelectorAll("video, audio")).toHaveLength(0);
  });

  it("cambiar de archivo olvida el fotograma del anterior", async () => {
    const primero = elegirArchivo("video", "video/mp4", "uno.mp4");
    pintar([medio("video", { fileName: "uno.mp4" })]);
    await waitFor(() => expect(miniatura()).not.toBeNull());

    // Reemplazar suelta el anterior; su fotograma deja de representar nada.
    const segundo = elegirArchivo("video", "video/mp4", "dos.mp4");

    expect(segundo).not.toBe(primero);
    await waitFor(() => expect(registro.cargadas).toContain(segundo));
  });

  it("olvidar una fuente permite volver a intentarlo", async () => {
    Object.assign(guion, { responde: "error" });
    const enlace = elegirArchivo("video", "video/mp4");
    pintar([medio("video", { fileName: "grabacion.mp4" })]);
    await new Promise((r) => setTimeout(r, 0));
    expect(registro.cargadas).toHaveLength(1);

    olvidarMiniatura(enlace);
    Object.assign(guion, { responde: "loadeddata" });
    cleanup();
    pintar([medio("video", { fileName: "grabacion.mp4" })]);

    await waitFor(() => expect(miniatura()?.src).toBe(FOTOGRAMA));
  });
});

describe("video e imagen se comportan igual en el nodo", () => {
  it("una imagen de la sesión se pinta con la misma clase que el video", async () => {
    elegirArchivo("image", "image/png", "foto.png");
    pintar([medio("image", { fileName: "foto.png" })]);

    const img = miniatura();
    expect(img).not.toBeNull();
    expect(img?.src).toContain("blob:falso/foto.png");
  });

  it("audio y archivo se quedan con su icono aunque tengan bytes", async () => {
    elegirArchivo("audio", "audio/mpeg", "voz.mp3");
    elegirArchivo("file", "application/pdf", "doc.pdf");

    pintar([
      medio("audio", { fileName: "voz.mp3" }),
      medio("file", { fileName: "doc.pdf" })
    ]);

    await new Promise((r) => setTimeout(r, 0));
    expect(iconos()).toBe(2);
    expect(document.querySelectorAll(".flow-node__block-thumb")).toHaveLength(0);
  });

  it("el fotograma no lleva texto alternativo: la fila ya dice qué es", async () => {
    // El `alt` vacío es deliberado: el fotograma es decorativo y quien lleva la
    // información es el rótulo de al lado, que nombra el tipo del bloque.
    elegirArchivo("video", "video/mp4");
    pintar([medio("video", { fileName: "grabacion.mp4" })]);

    await waitFor(() => expect(miniatura()).not.toBeNull());
    expect(miniatura()?.alt).toBe("");
    expect(screen.getByText("Video")).toBeTruthy();
    // Y el nombre del archivo ya no ocupa la fila.
    expect(screen.queryByText(/grabacion\.mp4/)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// UN FOTOGRAMA QUE NO ENSEÑA NADA NO ES UNA MINIATURA.
//
// Sacar siempre el instante 0.1 caía de lleno en el fundido de entrada, la
// claqueta o la primera décima en negro que traen muchísimos videos, y la
// miniatura salía lisa. Medido en los videos reales del usuario: brillo 0 en
// el segundo 0.1.
// ---------------------------------------------------------------------------

describe("el fotograma se busca hasta encontrar uno que enseñe algo", () => {
  it("si el video empieza con un fundido en negro, se salta más adentro", async () => {
    Object.assign(guion, { loQueSeVe: (s) => (s < 1 ? "liso" : "imagen") });
    elegirArchivo("video", "video/mp4");

    pintar([medio("video", { fileName: "grabacion.mp4" })]);

    await waitFor(() => expect(miniatura()?.src).toBe(FOTOGRAMA));
    expect(registro.saltos[0]).toBeCloseTo(0.1);
    expect(registro.saltos.length).toBeGreaterThan(1);
  });

  it("un video que enseña algo desde el principio se resuelve con un solo salto", async () => {
    // Lo normal no puede salir caro: si el primer instante vale, se para ahí.
    elegirArchivo("video", "video/mp4");

    pintar([medio("video", { fileName: "grabacion.mp4" })]);

    await waitFor(() => expect(miniatura()).not.toBeNull());
    expect(registro.saltos).toHaveLength(1);
  });

  it("un video entero liso termina en icono, no en un rectángulo de un color", async () => {
    // Es el caso de una grabación de pantalla que no capturó nada: 177 MB de
    // negro. Un recuadro negro parece un producto roto; el icono dice la
    // verdad —«esto es un video»— y además se entiende.
    Object.assign(guion, { loQueSeVe: () => "liso" });
    elegirArchivo("video", "video/mp4");

    pintar([medio("video", { fileName: "grabacion.mp4" })]);

    await waitFor(() => expect(registro.saltos.length).toBeGreaterThan(1));
    await new Promise((r) => setTimeout(r, 0));
    expect(miniatura()).toBeNull();
    expect(iconos()).toBe(1);
  });

  it("no se piden instantes que caen más allá del final del video", async () => {
    // Pedirlos devolvería el último fotograma, y un video que termina en negro
    // reproduciría el mismo defecto por el otro extremo.
    Object.assign(guion, { loQueSeVe: () => "liso", duracion: 2 });
    elegirArchivo("video", "video/mp4");

    pintar([medio("video", { fileName: "grabacion.mp4" })]);

    await waitFor(() => expect(registro.saltos.length).toBeGreaterThan(1));
    await new Promise((r) => setTimeout(r, 0));
    for (const salto of registro.saltos) expect(salto).toBeLessThan(2);
  });

  it("una escena oscura pero con relieve sí vale: no se descarta por oscura", async () => {
    // La pregunta es si VARÍA, no si es oscuro. Descartar lo oscuro tiraría
    // fotogramas legítimos de una escena nocturna.
    Object.assign(guion, { loQueSeVe: () => "imagen" });
    elegirArchivo("video", "video/mp4");

    pintar([medio("video", { fileName: "grabacion.mp4" })]);

    await waitFor(() => expect(miniatura()?.src).toBe(FOTOGRAMA));
    expect(registro.saltos).toHaveLength(1);
  });
});

describe("un fotograma casi negro tampoco sirve, aunque varíe un poco", () => {
  it("un fundido de entrada se rechaza y se prueba el instante siguiente", async () => {
    // ES LO QUE FALLABA. Con un umbral de contraste bajo, el primer fotograma
    // de un fundido pasaba por bueno: técnicamente variaba, pero se veía negro
    // y la miniatura no decía nada. Medido en un video real: contraste 12 en el
    // segundo 0.1 y 125 un segundo después.
    Object.assign(guion, { loQueSeVe: (s) => (s < 1 ? "penumbra" : "imagen") });
    elegirArchivo("video", "video/mp4");

    pintar([medio("video", { fileName: "fundido.mp4" })]);

    await waitFor(() => expect(miniatura()?.src).toBe(FOTOGRAMA));
    expect(registro.saltos.length).toBeGreaterThan(1);
  });

  it("una escena oscura CON relieve sí pasa a la primera", async () => {
    // La frontera medida: 12 se rechaza, 137 —una escena nocturna de verdad—
    // se acepta. Rechazar por oscuro tiraría fotogramas legítimos.
    Object.assign(guion, { loQueSeVe: () => "imagen" });
    elegirArchivo("video", "video/mp4");

    pintar([medio("video", { fileName: "noche.mp4" })]);

    await waitFor(() => expect(miniatura()?.src).toBe(FOTOGRAMA));
    expect(registro.saltos).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// EL ELEMENTO DE CAPTURA TIENE QUE ESTAR EN LA PÁGINA.
//
// Chrome decodifica un `<video>` creado y nunca insertado; WebKit no. Con el
// elemento suelto, `drawImage` copia un lienzo vacío, todos los instantes salen
// sin contraste y el resultado es el icono en el nodo y ningún poster en el
// editor — es decir, un cuadro negro en Safari.
// ---------------------------------------------------------------------------

describe("la captura ocurre dentro del documento y no deja rastro", () => {
  it("el elemento se inserta en la página mientras dura la captura", async () => {
    const dentro: boolean[] = [];
    vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockImplementation(() => {
      // En el momento de copiar el fotograma, el video debe estar en el DOM.
      dentro.push(document.querySelector("video") !== null);
      return FOTOGRAMA;
    });

    elegirArchivo("video", "video/mp4");
    pintar([medio("video", { fileName: "grabacion.mp4" })]);

    await waitFor(() => expect(miniatura()).not.toBeNull());
    expect(dentro.length).toBeGreaterThan(0);
    expect(dentro.every(Boolean)).toBe(true);
  });

  it("se aparta de la vista sin esconderlo: escondido tampoco decodifica", async () => {
    let estilo = "";
    const originalAppend = document.body.appendChild.bind(document.body);
    vi.spyOn(document.body, "appendChild").mockImplementation((n: Node) => {
      if ((n as HTMLElement).tagName === "VIDEO") estilo = (n as HTMLElement).style.cssText;
      return originalAppend(n);
    });

    elegirArchivo("video", "video/mp4");
    pintar([medio("video", { fileName: "grabacion.mp4" })]);
    await waitFor(() => expect(miniatura()).not.toBeNull());

    expect(estilo).not.toMatch(/display:\s*none/);
    expect(estilo).not.toMatch(/visibility:\s*hidden/);
    expect(estilo).toMatch(/position:\s*fixed/);
  });

  it("no queda ni un elemento de captura en la página al terminar", async () => {
    elegirArchivo("video", "video/mp4");
    pintar([medio("video", { fileName: "grabacion.mp4" })]);
    await waitFor(() => expect(miniatura()).not.toBeNull());

    expect(registro.retirados).toBe(1);
    expect(document.querySelectorAll("video")).toHaveLength(0);
  });

  it("también se retira cuando la captura falla", async () => {
    Object.assign(guion, { responde: "error" });
    elegirArchivo("video", "video/mp4");
    pintar([medio("video", { fileName: "grabacion.mp4" })]);

    await waitFor(() => expect(registro.retirados).toBe(1));
    expect(document.querySelectorAll("video")).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// SE PIDEN LOS DATOS QUE SE VAN A USAR.
//
// El elemento de captura espera `loadeddata` —readyState 2— pero pedía
// `preload="metadata"`, que significa «tráeme la ficha técnica y para». Chrome
// carga de más por su cuenta y llegaba a readyState 4 igualmente, así que el
// defecto quedaba tapado; WebKit lo cumple al pie de la letra y se detiene en
// readyState 1, así que `loadeddata` no llegaba nunca y la captura moría en su
// tope de tiempo. Medido en WebKit: `loadedmetadata @130ms rs=1`, `suspend
// @130ms`, y a los 5 segundos seguía sin un solo fotograma.
// ---------------------------------------------------------------------------

describe("el elemento de captura pide fotogramas, no solo la ficha técnica", () => {
  it("carga con `preload=auto`, que es lo que hace falta para copiar un frame", async () => {
    elegirArchivo("video", "video/mp4");
    pintar([medio("video", { fileName: "grabacion.mp4" })]);

    await waitFor(() => expect(miniatura()).not.toBeNull());
    expect(registro.preload).toBe("auto");
  });
});
