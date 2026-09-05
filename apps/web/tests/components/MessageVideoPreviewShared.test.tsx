import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { MessageEditor } from "@features/automations/builder/tools/message/MessageEditor";
import { FileSource } from "@features/automations/builder/tools/message/editor/FileSource";
import { MessageCompactBody } from "@features/automations/builder/tools/message/MessageCompactBody";
import {
  archivoDeSesion,
  enlaceDeSesion,
  soltarArchivo
} from "@features/automations/builder/tools/message/mediaSourceSession";
import { FOTOGRAMA, instalarNavegadorDeVideo, instalarObjectUrls, type Guion, type Registro } from "../helpers/navegadorDeVideo";
import { miniaturaYaObtenida } from "@features/automations/builder/tools/message/mediaThumbnails";

// ---------------------------------------------------------------------------
// UNA SOLA FUENTE DE VERDAD PARA LA IMAGEN DE UN MEDIO.
//
// El fotograma que enseña el nodo cerrado y el que enseña el editor son EL
// MISMO: se saca una vez y lo consumen los dos por la misma puerta. Estas
// pruebas comprueban justo eso —que los dos lo tienen, que es el mismo, y que
// se mantienen sincronizados cuando el archivo cambia o desaparece—, porque era
// exactamente lo que fallaba: el lienzo se quedaba con el icono aunque el
// fotograma ya existiera, y al editor no le llegaba nunca.
//
// Se entra por donde entra el usuario: eligiendo un archivo en `FileSource`.
// ---------------------------------------------------------------------------

let guion: Guion;
let registro: Registro;
let revocados: string[];

/** El bloque de video tal y como vive en `config.items`. */
const bloque = (extra: Record<string, unknown> = {}) => ({
  id: "v1",
  kind: "video",
  url: "",
  fileName: "",
  caption: "",
  sendOnce: false,
  ...extra
});

/**
 * El editor de verdad, con su estado.
 *
 * `FileSource` no guarda el nombre: lo sube. Sin este anfitrión, elegir un
 * archivo no cambiaría nada y la prueba mediría un editor congelado.
 */
function EditorDeVideo({ inicial = "" }: { inicial?: string }) {
  const [nombre, setNombre] = useState(inicial);
  return (
    <FileSource kind="video" position={1} itemId="v1" nombreGuardado={nombre} onPick={setNombre} />
  );
}

/** El nodo cerrado, leyendo el mismo bloque. */
const nodoCerrado = (items: ReadonlyArray<Record<string, unknown>>) =>
  render(<MessageCompactBody draft={{ config: { items } }} />);

const elegirEnElEditor = (nombre: string, tipo = "video/mp4") => {
  const input = document.querySelector<HTMLInputElement>(".media-file__input")!;
  fireEvent.change(input, { target: { files: [new File(["bytes"], nombre, { type: tipo })] } });
};

const videoDelEditor = () => document.querySelector<HTMLVideoElement>(".media-file__media");
const miniaturaDelNodo = () =>
  document.querySelector<HTMLImageElement>(".flow-node__block-thumb");
const iconosDelNodo = () => document.querySelectorAll(".flow-node__block-badge").length;

/** Deja que la captura termine y que React aplique el aviso. */
const dejarQueTermine = () => new Promise((r) => setTimeout(r, 0));

/**
 * Espera a que NO quede nada pendiente.
 *
 * Una captura encadena varias esperas —carga, y un salto por instante—, así que
 * un solo ciclo no basta para saber qué acabó pasando. Sin esto, una prueba
 * sobre resultados tardíos se cumpliría sola: mediría antes de que el resultado
 * llegara, y pasaría igual estando el defecto presente.
 */
const dejarQueTermineTodo = async () => {
  for (let i = 0; i < 15; i += 1) await dejarQueTermine();
};

beforeEach(() => {
  ({ guion, registro } = instalarNavegadorDeVideo());
  ({ revocados } = instalarObjectUrls());
});

afterEach(() => {
  cleanup();
  soltarArchivo("v1");
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("el editor expandido enseña el video antes de pulsar Play", () => {
  it("el <video> recibe un poster con el fotograma real", async () => {
    render(<EditorDeVideo />);
    elegirEnElEditor("clip.mp4");

    // Antes de que la captura termine no se inventa nada: no hay poster.
    expect(videoDelEditor()?.getAttribute("poster")).toBeNull();

    await dejarQueTermine();
    expect(videoDelEditor()?.getAttribute("poster")).toBe(FOTOGRAMA);
  });

  it("no hace falta reproducir para saber qué video se eligió", async () => {
    render(<EditorDeVideo />);
    elegirEnElEditor("clip.mp4");
    await dejarQueTermine();

    // El poster es del navegador: se ve sin Play y lo retira él al reproducir.
    // Por eso no hay ninguna capa encima que pudiera tapar los controles.
    const video = videoDelEditor()!;
    expect(video.getAttribute("poster")).toBe(FOTOGRAMA);
    expect(video.hasAttribute("controls")).toBe(true);
    expect(document.querySelectorAll(".media-file__preview img")).toHaveLength(0);
  });

  it("el editor y el nodo cerrado enseñan EXACTAMENTE la misma imagen", async () => {
    render(<EditorDeVideo />);
    elegirEnElEditor("clip.mp4");
    await dejarQueTermine();

    nodoCerrado([bloque({ fileName: "clip.mp4" })]);

    expect(miniaturaDelNodo()?.src).toBe(videoDelEditor()?.getAttribute("poster"));
    // Y se sacó UNA sola vez, no una por consumidor.
    expect(registro.cargadas).toHaveLength(1);
  });

  it("un video sin ningún fotograma útil no recibe poster inventado", async () => {
    Object.assign(guion, { loQueSeVe: () => "liso" });
    render(<EditorDeVideo />);
    elegirEnElEditor("negro.mp4");
    await dejarQueTermine();
    await dejarQueTermine();

    // Sin poster, no con `poster=""`: una cadena vacía es una imagen rota para
    // el navegador, no la ausencia de imagen.
    expect(videoDelEditor()?.getAttribute("poster")).toBeNull();
  });
});

describe("el nodo del lienzo se entera aunque el archivo llegue después", () => {
  it("pasa de icono a miniatura sin que nadie lo vuelva a montar", async () => {
    // ESTE ERA EL DEFECTO. El nodo se monta sin archivo; el usuario lo elige
    // después, en otra rama del árbol. Sin suscripción a la sesión, el nodo no
    // se enteraba y se quedaba con el icono. Medido en Chrome: fotograma listo
    // a los 836ms, nodo aún con icono a los 5200ms.
    nodoCerrado([bloque()]);
    expect(iconosDelNodo()).toBe(1);

    render(<EditorDeVideo />);
    elegirEnElEditor("clip.mp4");
    await dejarQueTermine();

    expect(miniaturaDelNodo()?.src).toBe(FOTOGRAMA);
    expect(iconosDelNodo()).toBe(0);
  });

  it("quitar el video devuelve el nodo a su icono", async () => {
    nodoCerrado([bloque()]);
    render(<EditorDeVideo />);
    elegirEnElEditor("clip.mp4");
    await dejarQueTermine();
    expect(miniaturaDelNodo()).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Quitar" }));

    expect(enlaceDeSesion("v1")).toBeNull();
    expect(miniaturaDelNodo()).toBeNull();
    expect(iconosDelNodo()).toBe(1);
  });
});

describe("cambiar de video no deja rastro del anterior", () => {
  it("el fotograma de A desaparece y aparece el de B", async () => {
    render(<EditorDeVideo />);
    elegirEnElEditor("A.mp4");
    await dejarQueTermine();
    const enlaceA = enlaceDeSesion("v1")!;
    expect(videoDelEditor()?.getAttribute("poster")).toBe(FOTOGRAMA);

    // El segundo video no da fotograma: si quedara el de A, se vería el de A.
    Object.assign(guion, { loQueSeVe: () => "liso" });
    elegirEnElEditor("B.mp4");
    await dejarQueTermine();
    await dejarQueTermine();

    const enlaceB = enlaceDeSesion("v1")!;
    expect(enlaceB).not.toBe(enlaceA);
    expect(videoDelEditor()?.getAttribute("poster")).toBeNull();
    // Y lo que se ve es B, no A: el nombre viaja en la etiqueta accesible
    // porque el video no lo pinta como texto.
    expect(videoDelEditor()?.getAttribute("aria-label")).toBe("B.mp4");
  });

  it("el Object URL del anterior se revoca al reemplazarlo", async () => {
    render(<EditorDeVideo />);
    elegirEnElEditor("A.mp4");
    const enlaceA = enlaceDeSesion("v1")!;

    elegirEnElEditor("B.mp4");

    expect(revocados).toContain(enlaceA);
    expect(revocados).not.toContain(enlaceDeSesion("v1"));
  });

  it("quitar el video revoca su Object URL", () => {
    render(<EditorDeVideo />);
    elegirEnElEditor("clip.mp4");
    const enlace = enlaceDeSesion("v1")!;

    fireEvent.click(screen.getByRole("button", { name: "Quitar" }));

    expect(revocados).toContain(enlace);
  });
});

describe("lo que no cambia", () => {
  it("el archivo original se guarda intacto: ni se reescribe ni se convierte", async () => {
    render(<EditorDeVideo />);
    elegirEnElEditor("clip.mp4");
    await dejarQueTermine();

    const guardado = archivoDeSesion("v1")!;
    expect(guardado.name).toBe("clip.mp4");
    expect(guardado.type).toBe("video/mp4");
    expect(guardado.size).toBe(5);
  });

  it("cerrar y reabrir el editor recupera el preview sin volver a capturar", async () => {
    const editor = render(<EditorDeVideo />);
    elegirEnElEditor("clip.mp4");
    await dejarQueTermine();
    expect(registro.cargadas).toHaveLength(1);

    // Cerrar el editor desmonta esto; los bytes siguen en la sesión.
    editor.unmount();
    render(<EditorDeVideo inicial="clip.mp4" />);
    await dejarQueTermine();

    expect(videoDelEditor()?.getAttribute("poster")).toBe(FOTOGRAMA);
    expect(registro.cargadas).toHaveLength(1);
  });

  it("un enlace remoto sigue funcionando y no pasa por la sesión", async () => {
    nodoCerrado([bloque({ url: "https://cdn.test/clip.mp4" })]);
    await dejarQueTermine();

    expect(registro.cargadas).toEqual(["https://cdn.test/clip.mp4"]);
    expect(miniaturaDelNodo()?.src).toBe(FOTOGRAMA);
    expect(enlaceDeSesion("v1")).toBeNull();
  });

  it("imagen, audio, archivo e intervalo se comportan como antes", async () => {
    nodoCerrado([
      { id: "i", kind: "image", url: "https://cdn.test/f.png", caption: "", sendOnce: false },
      { id: "a", kind: "audio", url: "https://cdn.test/f.mp3", caption: "", sendOnce: false },
      { id: "f", kind: "file", url: "https://cdn.test/f.pdf", caption: "", sendOnce: false },
      { id: "p", kind: "interval", amount: 5, unit: "seconds" }
    ]);
    await dejarQueTermine();

    // La imagen se pinta directa; audio y archivo con su icono; el intervalo
    // no aparece. Y ninguno de ellos monta un <video>.
    expect(document.querySelectorAll(".flow-node__block")).toHaveLength(3);
    expect(miniaturaDelNodo()?.src).toBe("https://cdn.test/f.png");
    expect(iconosDelNodo()).toBe(2);
    expect(registro.cargadas).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// LO QUE LLEGA TARDE.
//
// Una captura tarda cerca de un segundo y no se puede cancelar a mitad, así que
// el usuario tiene tiempo de sobra para cambiar de archivo antes de que
// termine. Estas pruebas fijan qué pasa con ese resultado tardío.
// ---------------------------------------------------------------------------

describe("un resultado que llega tarde no deja rastro", () => {
  it("el fotograma de A no se guarda si A ya fue reemplazado por B", async () => {
    render(<EditorDeVideo />);
    elegirEnElEditor("A.mp4");
    const enlaceA = enlaceDeSesion("v1")!;

    // B entra ANTES de que la captura de A haya podido terminar: elegir es
    // síncrono, la captura no.
    elegirEnElEditor("B.mp4");
    const enlaceB = enlaceDeSesion("v1")!;

    await dejarQueTermineTodo();

    // A ya no existe: su Object URL está revocado y su fotograma no puede
    // haberse quedado en la caché esperando a nadie.
    expect(revocados).toContain(enlaceA);
    expect(miniaturaYaObtenida(enlaceA, true)).toBeNull();
    // B, en cambio, sí tiene el suyo.
    expect(miniaturaYaObtenida(enlaceB, true)).toBe(FOTOGRAMA);
    expect(videoDelEditor()?.getAttribute("poster")).toBe(FOTOGRAMA);
  });

  it("A → B → A vuelve a enseñar A, con su propia captura", async () => {
    render(<EditorDeVideo />);
    elegirEnElEditor("A.mp4");
    await dejarQueTermine();
    const primeraA = enlaceDeSesion("v1")!;

    elegirEnElEditor("B.mp4");
    await dejarQueTermine();

    elegirEnElEditor("A.mp4");
    await dejarQueTermine();
    const segundaA = enlaceDeSesion("v1")!;

    // Es otro Object URL: el de la primera vez se revocó y no se reutiliza.
    expect(segundaA).not.toBe(primeraA);
    expect(revocados).toContain(primeraA);
    expect(videoDelEditor()?.getAttribute("poster")).toBe(FOTOGRAMA);
    expect(videoDelEditor()?.getAttribute("aria-label")).toBe("A.mp4");
    expect(registro.cargadas).toHaveLength(3);
  });

  it("nada queda retenido tras soltar: ni caché, ni Object URL", async () => {
    render(<EditorDeVideo />);
    elegirEnElEditor("clip.mp4");
    await dejarQueTermine();
    const enlace = enlaceDeSesion("v1")!;
    expect(miniaturaYaObtenida(enlace, true)).toBe(FOTOGRAMA);

    fireEvent.click(screen.getByRole("button", { name: "Quitar" }));

    expect(revocados).toContain(enlace);
    expect(miniaturaYaObtenida(enlace, true)).toBeNull();
    expect(enlaceDeSesion("v1")).toBeNull();
    expect(archivoDeSesion("v1")).toBeNull();
  });
});

describe("borrar el bloque entero suelta su archivo", () => {
  it("el Object URL se revoca y la sesión queda limpia", async () => {
    // `FileSource` solo suelta al reemplazar o al pulsar «Quitar». Borrando el
    // bloque no se pasa por ninguno de los dos, así que el archivo se quedaba
    // retenido hasta recargar la página.
    let config: Record<string, unknown> = {
      items: [{ id: "v1", kind: "video", url: "", fileName: "", caption: "", sendOnce: false }]
    };
    const editor = render(
      <MessageEditor
        draft={{ name: "", content: {}, config }}
        onChange={(patch) => void (config = patch.config as Record<string, unknown>)}
      />
    );

    elegirEnElEditor("clip.mp4");
    await dejarQueTermine();
    const enlace = enlaceDeSesion("v1")!;
    expect(enlace).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /^Eliminar / }));

    expect(revocados).toContain(enlace);
    expect(enlaceDeSesion("v1")).toBeNull();
    expect(archivoDeSesion("v1")).toBeNull();
    expect((config.items as unknown[])).toHaveLength(0);
    editor.unmount();
  });
});
