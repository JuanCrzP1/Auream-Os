import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MessageEditor } from "@features/automations/builder/tools/message/MessageEditor";
import type { NodePatch } from "@features/automations/builder/services/applyNodePatch";
import { bloqueCss } from "../helpers/messageCss";

// ---------------------------------------------------------------------------
// Preview del archivo elegido, dentro de la zona de carga.
//
// LO QUE SE FIJA AQUÍ es que elegir un archivo NO cambie de contenedor. Antes
// `FileSource` devolvía dos árboles distintos —zona grande vacía, ficha
// compacta con archivo— y la caja encogía ~58px al elegir, empujando hacia
// arriba la descripción y el interruptor. Ahora es el mismo `.media-file` con
// otro contenido dentro.
//
// El alto real NO se comprueba en píxeles: jsdom no maqueta y una prueba así
// mediría cero y pasaría siempre. Lo que sí se comprueba —y es lo que se
// rompería en una regresión— es que exista UNA sola declaración de alto y que
// no haya vuelto a aparecer una regla de layout para el estado con archivo.
//
// Imagen y Video comparten todo menos la etiqueta del preview, así que los dos
// recorren exactamente la misma batería.
// ---------------------------------------------------------------------------

/** Object URLs deterministas: jsdom no implementa ninguna de las dos. */
let creados: string[] = [];
let revocados: string[] = [];

beforeEach(() => {
  creados = [];
  revocados = [];
  let n = 0;

  vi.stubGlobal("URL", {
    ...URL,
    createObjectURL: vi.fn(() => {
      const url = `blob:mock/${++n}`;
      creados.push(url);
      return url;
    }),
    revokeObjectURL: vi.fn((url: string) => void revocados.push(url))
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/**
 * Monta el editor CONTROLADO, como lo monta el marco de verdad.
 *
 * El borrador vuelve a bajar tras cada cambio. Con un `draft` fijo, elegir un
 * archivo no tenía efecto visible: el nombre subía por `onChange` y nadie lo
 * devolvía, así que el bloque seguía creyéndose vacío. La realidad es un ciclo
 * cerrado y el arnés tiene que serlo también.
 */
function renderBloque(kind: "image" | "video" | "audio" | "file") {
  const onChange = vi.fn<(patch: NodePatch) => void>();
  let config: Record<string, unknown> = {
    items: [{ id: "x", kind, url: "", caption: "", sendOnce: false }]
  };

  function Anfitrion() {
    const [estado, setEstado] = useState(config);
    config = estado;

    return (
      <MessageEditor
        draft={{ name: "Mensaje", content: {}, config: estado }}
        onChange={(patch) => {
          onChange(patch);
          if (patch.config) setEstado(patch.config as Record<string, unknown>);
        }}
      />
    );
  }

  const utils = render(<Anfitrion />);
  return { ...utils, onChange, configActual: () => config };
}

const zona = (c: HTMLElement) => c.querySelector(".media-file");
const entrada = (c: HTMLElement) => c.querySelector<HTMLInputElement>(".media-file__input")!;

/** Elegir un archivo por el diálogo del sistema. `files` es de solo lectura. */
function elegir(c: HTMLElement, nombre: string, tipo: string) {
  const input = entrada(c);
  const archivo = new File(["contenido"], nombre, { type: tipo });

  Object.defineProperty(input, "files", { value: [archivo], configurable: true });
  fireEvent.change(input);

  return archivo;
}

const MEDIOS = [
  { kind: "image", etiqueta: "img", nombre: "foto.png", mime: "image/png" },
  { kind: "video", etiqueta: "video", nombre: "clip.mp4", mime: "video/mp4" }
] as const;

describe.each(MEDIOS)("zona de carga de $kind", ({ kind, etiqueta, nombre, mime }) => {
  it("sin archivo muestra el estado vacío dentro de la zona", () => {
    const { container } = renderBloque(kind);

    expect(zona(container)).not.toBeNull();
    expect(container.querySelector(".media-file__hint")).not.toBeNull();
    expect(container.querySelector(".media-file__preview")).toBeNull();
  });

  it("al elegir un archivo aparece el preview en la MISMA zona", () => {
    const { container } = renderBloque(kind);
    const antes = zona(container);

    elegir(container, nombre, mime);

    // El mismo nodo del DOM, no otro contenedor con el mismo aspecto.
    expect(zona(container)).toBe(antes);
    // Y sigue habiendo exactamente una zona: no se ha añadido una segunda.
    expect(container.querySelectorAll(".media-file")).toHaveLength(1);
    expect(container.querySelector(".media-file__media")?.tagName.toLowerCase()).toBe(etiqueta);
    // El estado vacío ha desaparecido de dentro, pero la caja sigue siendo la misma.
    expect(container.querySelector(".media-file__hint")).toBeNull();
  });

  it("el preview usa el Object URL creado para ese archivo", () => {
    const { container } = renderBloque(kind);

    elegir(container, nombre, mime);

    expect(creados).toHaveLength(1);
    expect(container.querySelector(".media-file__media")?.getAttribute("src")).toBe(creados[0]);
  });

  it("no reaparece `--picked` ni ningún contenedor alternativo", () => {
    const { container } = renderBloque(kind);

    elegir(container, nombre, mime);

    expect(container.querySelector(".media-file--picked")).toBeNull();
    expect(zona(container)?.className).not.toContain("picked");
  });

  it("estructura: la zona tiene un hueco para el medio y otro para las acciones", () => {
    const { container } = renderBloque(kind);

    elegir(container, nombre, mime);

    const caja = zona(container)!;
    const preview = caja.querySelector(".media-file__preview")!;
    const acciones = caja.querySelector(".media-file__actions")!;

    // Hermanos dentro de la MISMA caja: el medio no comparte hueco con los
    // botones, que es lo que le devuelve la altura entera.
    expect(preview.parentElement).toBe(caja);
    expect(acciones.parentElement).toBe(caja);
    // El medio va dentro del hueco del medio, no suelto en la caja.
    expect(caja.querySelector(".media-file__media")?.parentElement).toBe(preview);
    // Y los botones no se superponen al medio: están fuera de su hueco.
    expect(preview.querySelector(".media-file__control")).toBeNull();
  });

  it("las acciones son Cambiar y Quitar, y solo esas", () => {
    const { container } = renderBloque(kind);

    elegir(container, nombre, mime);

    const acciones = zona(container)!.querySelectorAll(".media-file__actions button");
    expect([...acciones].map((b) => b.textContent)).toEqual(["Cambiar", "Quitar"]);
  });

  it("«Cambiar» reemplaza el preview y revoca el Object URL anterior", () => {
    const { container } = renderBloque(kind);

    elegir(container, nombre, mime);
    const primero = creados[0];

    // Reutiliza el MISMO input: no hay un segundo sistema de selección.
    expect(container.querySelectorAll(".media-file__input")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Cambiar" }));
    elegir(container, `otro-${nombre}`, mime);

    expect(creados).toHaveLength(2);
    expect(revocados).toContain(primero);
    expect(container.querySelector(".media-file__media")?.getAttribute("src")).toBe(creados[1]);
    expect(container.querySelectorAll(".media-file")).toHaveLength(1);
  });

  it("«Quitar» revoca el Object URL y devuelve la zona al estado vacío", () => {
    const { container } = renderBloque(kind);

    elegir(container, nombre, mime);
    fireEvent.click(screen.getByRole("button", { name: "Quitar" }));

    expect(revocados).toContain(creados[0]);
    expect(container.querySelector(".media-file__preview")).toBeNull();
    expect(container.querySelector(".media-file__hint")).not.toBeNull();
    expect(container.querySelectorAll(".media-file")).toHaveLength(1);
  });

  it("desmontar NO revoca: los bytes son de la sesión, no del componente", () => {
    // Cambio deliberado. Revocar al desmontar dejaba la imagen rota al reabrir
    // el nodo, porque el enlace moría con el editor. Ahora lo administra la
    // sesión y solo se suelta al reemplazar el archivo o al quitarlo.
    const { container, unmount } = renderBloque(kind);

    elegir(container, nombre, mime);
    expect(revocados).toHaveLength(0);

    unmount();

    expect(revocados).toHaveLength(0);
  });

  it("el archivo no llega a la configuración del nodo", () => {
    // El `File` es temporal por diseño: no hay almacenamiento donde subirlo, y
    // escribir su nombre fingiría una subida que no ocurre.
    const { container, onChange } = renderBloque(kind);

    elegir(container, nombre, mime);

    const items = (onChange.mock.lastCall?.[0].config?.items ?? []) as Array<
      Record<string, unknown>
    >;
    if (items.length > 0) expect(items[0].url).toBe("");
    expect(JSON.stringify(onChange.mock.calls)).not.toContain("blob:mock");
  });
});

describe("Archivo sigue usando la tarjeta genérica", () => {
  it("se identifica por nombre, sin medio que pintar", () => {
    const { container } = renderBloque("file");

    elegir(container, "doc.pdf", "application/pdf");

    // Misma caja, mismo hueco, mismas acciones.
    expect(container.querySelectorAll(".media-file")).toHaveLength(1);
    expect(container.querySelector(".media-file__preview")).not.toBeNull();
    expect(container.querySelector(".media-file__actions")).not.toBeNull();
    expect(container.querySelector(".media-file__named")).not.toBeNull();
    // Ni medio ni reproductor: Archivo no ganó nada de Audio.
    expect(container.querySelector(".media-file__media")).toBeNull();
    expect(container.querySelector(".media-audio")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Quitar" }));
    expect(revocados).toContain(creados[0]);
    expect(container.querySelector(".media-file__hint")).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Reproductor de audio.
//
// jsdom NO implementa `HTMLMediaElement.play()` ni calcula `duration`: se
// espían play/pause y se dirige el estado con los EVENTOS REALES del elemento,
// que es exactamente de donde el componente lo lee en producción. No hay ni un
// atajo escrito en el componente para que estas pruebas pasen.
// ---------------------------------------------------------------------------

describe("reproductor de audio", () => {
  const elemento = (c: HTMLElement) => c.querySelector<HTMLAudioElement>("audio")!;
  const onda = () => screen.getByRole("slider");

  // jsdom no implementa ninguna de las dos y las anota por la consola virtual
  // en cada llamada. Se espían para todo el bloque: así se observa QUE se
  // llaman —que es lo que importa— sin que el componente tenga que saberlo.
  let play: ReturnType<typeof vi.spyOn>;
  let pause: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    play = vi
      .spyOn(HTMLMediaElement.prototype, "play")
      .mockImplementation(() => undefined as unknown as Promise<void>);
    pause = vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
  });

  afterEach(() => {
    // Desmontar ANTES de restaurar: la limpieza automática de la biblioteca
    // corre después de este hook, y para entonces el `pause()` del desmontaje
    // ya no estaría espiado.
    cleanup();
    play.mockRestore();
    pause.mockRestore();
  });

  /** Fija una propiedad que jsdom deja de solo lectura. */
  function definir(el: HTMLElement, prop: string, valor: unknown) {
    Object.defineProperty(el, prop, { value: valor, writable: true, configurable: true });
  }

  /** Monta un bloque de audio con el archivo ya elegido y sus metadatos leídos. */
  function conAudio(duracion = 83) {
    const utils = renderBloque("audio");
    elegir(utils.container, "voz.mp3", "audio/mpeg");

    const el = elemento(utils.container);
    definir(el, "duration", duracion);
    definir(el, "currentTime", 0);
    definir(el, "paused", true);
    fireEvent(el, new Event("loadedmetadata"));

    return { ...utils, el };
  }

  it("un audio cargado muestra el reproductor, no la tarjeta genérica", () => {
    const { container } = conAudio();

    expect(container.querySelector(".media-audio")).not.toBeNull();
    expect(container.querySelector("audio")).not.toBeNull();
    // Lo que se retira: la ficha de archivo con insignia, nombre y tamaño.
    expect(container.querySelector(".media-file__named")).toBeNull();
    // Y sigue dentro de la MISMA zona, con sus acciones intactas.
    expect(container.querySelectorAll(".media-file")).toHaveLength(1);
    expect(container.querySelector(".media-file__actions")).not.toBeNull();
  });

  it("la onda son barras y distingue lo reproducido de lo pendiente", () => {
    const { container, el } = conAudio();

    const barras = container.querySelectorAll(".media-audio__bar");
    expect(barras.length).toBeGreaterThan(10);
    expect(container.querySelectorAll(".media-audio__bar--sonada")).toHaveLength(0);

    definir(el, "currentTime", 41.5);
    fireEvent(el, new Event("timeupdate"));

    // A mitad del audio, la mitad de las barras están marcadas.
    const sonadas = container.querySelectorAll(".media-audio__bar--sonada").length;
    expect(sonadas).toBeGreaterThan(barras.length * 0.4);
    expect(sonadas).toBeLessThan(barras.length * 0.6);
  });

  it("la onda no cambia entre renders para el mismo archivo", () => {
    const { container, el } = conAudio();
    const antes = [...container.querySelectorAll(".media-audio__bar")].map(
      (b) => (b as HTMLElement).style.height
    );

    definir(el, "currentTime", 10);
    fireEvent(el, new Event("timeupdate"));

    const despues = [...container.querySelectorAll(".media-audio__bar")].map(
      (b) => (b as HTMLElement).style.height
    );
    expect(despues).toEqual(antes);
  });

  it("Play inicia la reproducción de verdad", () => {
    const { el } = conAudio();

    fireEvent.click(screen.getByRole("button", { name: /^Reproducir/ }));

    expect(play).toHaveBeenCalledTimes(1);

    // El botón no se cree a sí mismo: cambia cuando el ELEMENTO avisa.
    definir(el, "paused", false);
    fireEvent(el, new Event("play"));
    expect(screen.getByRole("button", { name: /^Pausar/ })).toBeTruthy();
  });

  it("Pause detiene la reproducción", () => {
    const { el } = conAudio();

    definir(el, "paused", false);
    fireEvent(el, new Event("play"));
    fireEvent.click(screen.getByRole("button", { name: /^Pausar/ }));

    expect(pause).toHaveBeenCalled();

    definir(el, "paused", true);
    fireEvent(el, new Event("pause"));
    expect(screen.getByRole("button", { name: /^Reproducir/ })).toBeTruthy();
  });

  it("la duración sale del metadata real del elemento", () => {
    const { container } = conAudio(83);

    // 83s = 1:23, leído de `duration`, no inventado.
    expect(container.querySelector(".media-audio__time")?.textContent).toContain("1:23");
    expect(onda().getAttribute("aria-valuemax")).toBe("83");
  });

  it("currentTime actualiza el tiempo transcurrido y el progreso", () => {
    const { container, el } = conAudio(83);

    definir(el, "currentTime", 7);
    fireEvent(el, new Event("timeupdate"));

    expect(container.querySelector(".media-audio__time")?.textContent).toContain("0:07");
    expect(onda().getAttribute("aria-valuenow")).toBe("7");
  });

  it("al terminar vuelve al estado reproducible desde el principio", () => {
    const { container, el } = conAudio(83);

    definir(el, "paused", false);
    fireEvent(el, new Event("play"));
    definir(el, "currentTime", 83);
    fireEvent(el, new Event("timeupdate"));
    fireEvent(el, new Event("ended"));

    expect(screen.getByRole("button", { name: /^Reproducir/ })).toBeTruthy();
    expect(el.currentTime).toBe(0);
    expect(container.querySelector(".media-audio__time")?.textContent).toContain("0:00");
    expect(container.querySelectorAll(".media-audio__bar--sonada")).toHaveLength(0);
  });

  it("pulsar la onda busca esa posición en el audio", () => {
    const { el } = conAudio(100);

    // jsdom no maqueta: la caja del control se fija para poder pulsarla.
    onda().getBoundingClientRect = () =>
      ({ left: 0, width: 200, top: 0, height: 38, right: 200, bottom: 38, x: 0, y: 0 }) as DOMRect;

    fireEvent.click(onda(), { clientX: 50 });

    // Un cuarto del ancho sobre 100s.
    expect(el.currentTime).toBe(25);
    expect(onda().getAttribute("aria-valuenow")).toBe("25");
  });

  it("las flechas también mueven la posición", () => {
    const { el } = conAudio(100);

    definir(el, "currentTime", 20);
    fireEvent(el, new Event("timeupdate"));
    fireEvent.keyDown(onda(), { key: "ArrowRight" });

    expect(el.currentTime).toBe(25);
  });

  it("cambiar de audio reinicia el reproductor y no arrastra el anterior", () => {
    const { container, el } = conAudio(83);

    definir(el, "currentTime", 40);
    fireEvent(el, new Event("timeupdate"));
    expect(container.querySelector(".media-audio__time")?.textContent).toContain("0:40");

    fireEvent.click(screen.getByRole("button", { name: "Cambiar" }));
    elegir(container, "otra-voz.mp3", "audio/mpeg");

    // Object URL anterior revocado y reproductor a cero: ni posición ni
    // duración del archivo viejo sobreviven.
    expect(revocados).toContain(creados[0]);
    expect(container.querySelector(".media-audio__time")?.textContent).toContain("0:00 / 0:00");
    expect(container.querySelectorAll("audio")).toHaveLength(1);
  });

  it("quitar el audio retira el reproductor y revoca el recurso", () => {
    const { container } = conAudio();

    fireEvent.click(screen.getByRole("button", { name: "Quitar" }));

    expect(container.querySelector(".media-audio")).toBeNull();
    expect(container.querySelector("audio")).toBeNull();
    expect(revocados).toContain(creados[0]);
    expect(container.querySelector(".media-file__hint")).not.toBeNull();
    // Se detiene al desmontar en vez de seguir sonando sin interfaz.
    expect(pause).toHaveBeenCalled();
  });

  it("no persiste nada de la reproducción en la configuración del nodo", () => {
    const { container, onChange, el } = conAudio(83);

    definir(el, "currentTime", 12);
    fireEvent(el, new Event("timeupdate"));

    const items = (onChange.mock.lastCall?.[0].config?.items ?? []) as Array<
      Record<string, unknown>
    >;
    if (items.length > 0) expect(items[0].url).toBe("");
    expect(JSON.stringify(onChange.mock.calls)).not.toContain("blob:mock");
    expect(container.querySelector(".media-audio")).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Fronteras del módulo de preview.
//
// Se leen del código fuente porque son propiedades ESTRUCTURALES: que el
// reproductor no se filtre a los demás tipos y que el dueño del archivo siga
// siendo uno solo no se puede observar renderizando.
// ---------------------------------------------------------------------------

describe("el reproductor queda encapsulado", () => {
  const RUTA =
    "src/features/automations/builder/tools/message/editor/MediaFilePreview.tsx";
  const fuente = readFileSync(RUTA, "utf8");
  /**
   * El código sin comentarios.
   *
   * El archivo está muy comentado y la prosa NOMBRA justo lo que estas pruebas
   * niegan —«no hay `addEventListener` que limpiar a mano»—. Sin retirarla, la
   * comprobación fallaría por lo que el archivo EXPLICA en vez de por lo que
   * hace.
   */
  const codigo = fuente.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

  it("MediaFilePreview no declara hooks: el estado es solo del audio", () => {
    // El cuerpo del componente exportado, que es lo último del archivo.
    const exportado = codigo.slice(codigo.indexOf("export function MediaFilePreview"));

    expect(exportado).not.toMatch(/\buse(State|Ref|Effect|Memo|Callback)\s*\(/);
  });

  it("no duplica el dueño del archivo ni del Object URL", () => {
    // El `File` y su Object URL son de `FileSource`. Aquí solo llega un `src`.
    expect(codigo).not.toContain("createObjectURL");
    expect(codigo).not.toContain("revokeObjectURL");
    expect(codigo).not.toMatch(/:\s*File\b/);
  });

  it("el reproductor no se exporta: no es una segunda entrada de preview", () => {
    expect(codigo).toMatch(/function ReproductorAudio/);
    expect(codigo).not.toMatch(/export\s+(function|const)\s+ReproductorAudio/);
    expect(codigo.match(/^export /gm) ?? []).toHaveLength(1);
  });

  it("no usa addEventListener: los escuchadores son props de React", () => {
    expect(codigo).not.toContain("addEventListener");
  });
});

describe("preview de video", () => {
  it("trae controles y solo los metadatos, no el video entero", () => {
    const { container } = renderBloque("video");

    elegir(container, "clip.mp4", "video/mp4");

    const video = container.querySelector<HTMLVideoElement>(".media-file__media")!;
    expect(video.tagName.toLowerCase()).toBe("video");
    expect(video.hasAttribute("controls")).toBe(true);
    expect(video.getAttribute("preload")).toBe("metadata");
  });
});

// ---------------------------------------------------------------------------
// El alto de la zona.
//
// Se lee el CSS real: es donde vive la garantía. Lo que no puede volver a
// existir es una segunda declaración de alto para el estado con archivo, que es
// exactamente lo que producía el salto.
// ---------------------------------------------------------------------------

describe("una sola altura para los dos estados", () => {
  const RUTA = "src/features/automations/builder/tools/message/styles/message-media.css";
  const hoja = readFileSync(RUTA, "utf8");

  /**
   * Las DECLARACIONES de una regla, sin sus comentarios.
   *
   * Estas reglas están muy comentadas y la prosa explica precisamente las
   * propiedades que se afirman —«sin `width`/`height`», «`max-height: 100%`»—.
   * Sin retirarlas, una comprobación negativa encontraría el texto del
   * comentario y fallaría por lo que la regla EXPLICA, no por lo que declara.
   */
  const declaraciones = (selector: string) =>
    bloqueCss(selector).replace(/\/\*[\s\S]*?\*\//g, "");

  it("la zona declara su alto desde el token, no desde su contenido", () => {
    expect(declaraciones(".media-file")).toMatch(/height:\s*var\(--media-area-height\)/);
  });

  it("el token se declara UNA sola vez en todo el módulo", () => {
    expect(hoja.match(/--media-area-height:/g) ?? []).toHaveLength(1);
    expect(hoja).toMatch(/--media-area-height:\s*112px/);
  });

  it("`.media-file--picked` ya no existe como concepto de layout", () => {
    expect(hoja).not.toContain("media-file--picked");
    expect(() => bloqueCss(".media-file--picked")).toThrow();
  });

  it("la caja declara también su ancho: no depende de quién la contenga", () => {
    expect(declaraciones(".media-file")).toMatch(/width:\s*100%/);
  });

  it("la zona de medios sigue teniendo UNA sola altura, venga del valor que venga", () => {
    // El valor se ha movido —140px al agrandar el preview, 120px al compactar
    // las tarjetas— y volverá a moverse. Lo que NO puede moverse es que salga
    // de un único token y que la caja no gane medidas propias por el camino.
    const regla = declaraciones(".media-file");

    expect(regla).toMatch(/height:\s*var\(--media-area-height\)/);
    expect(regla).toMatch(/padding:\s*13px\s+12px/);
    expect(hoja.match(/height:\s*var\(--media-area-height\)/g) ?? []).toHaveLength(1);
  });

  it("el hueco del medio absorbe el espacio sin dejar que el medio lo imponga", () => {
    const regla = declaraciones(".media-file__preview");

    // Base 0 y no `auto`: con `auto` el reparto partiría del ancho intrínseco
    // de la foto, que puede ser de miles de píxeles.
    expect(regla).toMatch(/flex:\s*1\s+1\s+0/);
    // Las dos reglas que impiden que el tamaño intrínseco del medio suba al
    // padre y rompa el alto declarado. `min-width: 0` es la crítica: el mínimo
    // automático de un elemento flex es el tamaño de su contenido.
    expect(regla).toMatch(/min-width:\s*0/);
    expect(regla).toMatch(/min-height:\s*0/);
    // Se estira con el mecanismo del propio flex en vez de declarar altura:
    // así el hueco tiene una altura definida contra la que el tope del medio
    // puede resolverse, sin que ninguna medida se escriba dos veces.
    expect(regla).toMatch(/align-self:\s*stretch/);
    expect(regla).not.toMatch(/(?<!min-|max-)height:\s*\d/);
  });

  it("el medio se dimensiona por topes, nunca por un tamaño impuesto", () => {
    const regla = declaraciones(".media-file__media");

    // Sin `width`/`height` y con los dos topes al 100%, el navegador reduce el
    // tamaño intrínseco en proporción hasta cumplir las dos restricciones: por
    // definición, el mayor tamaño que cabe sin recortar ni deformar.
    expect(regla).toMatch(/max-width:\s*100%/);
    expect(regla).toMatch(/max-height:\s*100%/);
    expect(regla).toMatch(/object-fit:\s*contain/);
    // Este era el defecto: `width: 100%` hacía que el elemento midiera los
    // 636px aunque la foto pintada dentro fuera de 79.
    expect(regla).not.toMatch(/(?<!max-)width:\s*\d/);
    expect(regla).not.toMatch(/(?<!min-|max-)height:\s*\d/);
    // Nunca rellenar recortando.
    expect(regla).not.toMatch(/object-fit:\s*cover/);
  });

  it("la fila del estado con archivo se activa por contenido, no por una clase", () => {
    // Es lo que permite que no exista `--picked`: una sola caja cuyo eje
    // depende de lo que tenga dentro.
    expect(hoja).toMatch(/\.media-file:has\(\.media-file__preview\)\s*\{/);
    expect(declaraciones(".media-file:has(.media-file__preview)")).toMatch(
      /flex-direction:\s*row/
    );
  });

  it("las acciones tienen ancho compacto y estable", () => {
    const regla = declaraciones(".media-file__actions");

    // Ni crecen ni se encogen: el hueco que le queda al medio no depende de la
    // foto que haya dentro. Y sin `width`: su ancho es el de sus botones, no
    // una columna reservada.
    expect(regla).toMatch(/flex:\s*0\s+0\s+auto/);
    expect(regla).not.toMatch(/(?<!max-|min-)width:/);
  });

  it("con archivo se recupera el padding vertical: el medio usa toda la altura", () => {
    // Los 26px de aire son del estado vacío. Para el medio son altura perdida,
    // y la altura es la restricción que ata. Sin esto el hueco es de 80px; con
    // esto, de 106px.
    const fila = declaraciones(".media-file:has(.media-file__preview)");

    expect(fila).toMatch(/padding:\s*0\s+\d+px/);
    // Y no puede afectar al tamaño de la caja: el alto está declarado y el
    // modelo de caja es `border-box`, así que el padding se reparte DENTRO.
    expect(declaraciones(".media-file")).toMatch(/height:\s*var\(--media-area-height\)/);
    expect(readFileSync("src/shared/styles/base.css", "utf8")).toMatch(
      /box-sizing:\s*border-box/
    );
  });

  it("ni Imagen ni Video declaran alto, ancho ni layout propios", () => {
    // La única diferencia permitida entre los dos es la etiqueta del medio.
    expect(hoja).not.toMatch(/\.media-file[^\n]*--(image|video|audio)/);
    expect(hoja.match(/height:\s*var\(--media-area-height\)/g) ?? []).toHaveLength(1);
  });

  it("no quedan selectores muertos del layout anterior", () => {
    expect(hoja).not.toContain("media-file__controls");
    expect(hoja).not.toContain("media-file__preview--named");
  });
});
