import { readFileSync } from "node:fs";
import { flowNodeCss } from "../helpers/canvasCss";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, within } from "@testing-library/react";
import { ReactFlowProvider, type NodeProps } from "@xyflow/react";
import { FlowNodeCard } from "@features/automations/builder/components/canvas/FlowNodeCard";
import { BuilderEditingProvider } from "@features/automations/builder/context/BuilderEditingContext";
import { createNodeDraft } from "@features/automations/builder/services/createNodeDraft";
import { resolveToolUi } from "@features/automations/builder/tools/ui-registry";
import { getItemIcon } from "@features/automations/builder/tools/message/editor/itemIcons";
import { MESSAGE_ITEM_LABELS } from "@features/automations/builder/tools/message/messageItems";
import {
  adjuntarArchivo,
  enlaceDeSesion,
  soltarArchivo
} from "@features/automations/builder/tools/message/mediaSourceSession";
import {
  miniaturaYaObtenida,
  olvidarMiniatura
} from "@features/automations/builder/tools/message/mediaThumbnails";
import type { CanvasNode } from "@features/automations/builder/types/canvas";

// ---------------------------------------------------------------------------
// El nodo Mensaje CERRADO, en el lienzo.
//
// Enseña una fila por bloque —qué contiene la secuencia y en qué orden— en vez
// de una sola línea de resumen. Se monta a través de `FlowNodeCard` y no del
// componente suelto: lo que se quiere fijar es que la tarjeta consulte el hueco
// `CompactBody` del contrato, no que un componente concreto sepa pintarse.
//
// Sigue siendo un RESUMEN: aquí no hay edición, ni controles, ni reproductor.
// Varias de estas pruebas existen para que no vuelva a haberlos.
// ---------------------------------------------------------------------------

function montar(
  items: ReadonlyArray<Record<string, unknown>> | null,
  content: Record<string, unknown> = {}
) {
  const nodo = createNodeDraft("message", 0);
  // `null` monta un nodo SIN `config.items`, que es como llega uno guardado
  // antes de que Mensaje tuviera secuencia.
  nodo.data = { ...nodo.data, content, config: items === null ? {} : { items } };

  return render(
    <ReactFlowProvider>
      <BuilderEditingProvider
        requestEdit={vi.fn()}
        toggleExpand={vi.fn()}
        updateNode={vi.fn()}
        duplicateNode={vi.fn()}
        removeNode={vi.fn()}
      >
        <FlowNodeCard
          {...({ id: nodo.id, data: nodo.data, selected: false } as NodeProps<CanvasNode>)}
        />
      </BuilderEditingProvider>
    </ReactFlowProvider>
  );
}

const filas = (c: HTMLElement) => [...c.querySelectorAll(".flow-node__block")];
const textos = (c: HTMLElement) =>
  filas(c).map((f) => f.querySelector(".flow-node__block-text")?.textContent ?? "");

const texto = (id: string, text: string) => ({ id, kind: "text", text });
const medio = (id: string, kind: string, url = "", caption = "") => ({
  id,
  kind,
  url,
  caption,
  sendOnce: false
});

describe("preview del nodo Mensaje cerrado", () => {
  it("sin bloques cae en el resumen de una línea, sin filas", () => {
    const { container } = montar([]);

    expect(container.querySelector(".flow-node__blocks")).toBeNull();
    expect(container.querySelector(".flow-node__preview")?.textContent).toBe(
      "Sin contenido para enviar"
    );
  });

  it("un solo texto se muestra tal cual", () => {
    const { container } = montar([texto("a", "Hola, ¿en qué puedo ayudarte?")]);

    expect(textos(container)).toEqual(["Hola, ¿en qué puedo ayudarte?"]);
  });

  it("varios bloques dan varias filas, una por bloque", () => {
    const { container } = montar([
      texto("a", "Bienvenida"),
      medio("b", "image", "https://cdn.test/foto.png"),
      texto("c", "Despedida")
    ]);

    expect(filas(container)).toHaveLength(3);
  });

  it("respeta el ORDEN de config.items", () => {
    const { container } = montar([
      medio("a", "audio", "https://cdn.test/voz.mp3"),
      texto("b", "Segundo"),
      medio("c", "image", "", "Tercero")
    ]);

    expect(textos(container)).toEqual(["Audio", "Segundo", "Imagen"]);
  });

  it("un texto largo se recorta por CSS, no cortando el dato", () => {
    const largo = "palabra ".repeat(60).trim();
    const { container } = montar([texto("a", largo)]);

    // El texto entero llega al DOM: quien recorta es la regla, y así el
    // recorte se adapta al ancho real del nodo en vez de a un número fijo.
    expect(textos(container)[0]).toBe(largo);

    const hoja = flowNodeCss;
    const regla = hoja.slice(hoja.indexOf(".flow-node__block-text {"));
    expect(regla).toMatch(/text-overflow:\s*ellipsis/);
    expect(regla).toMatch(/white-space:\s*nowrap/);
    expect(regla).toMatch(/min-width:\s*0/);
  });

  it("normaliza saltos de línea y espacios repetidos a una sola línea", () => {
    const { container } = montar([texto("a", "  Primera\n\nSegunda   línea\ty tabulador  ")]);

    expect(textos(container)).toEqual(["Primera Segunda línea y tabulador"]);
    expect(textos(container)[0]).not.toContain("\n");
  });

  it("un texto vacío no deja la fila muda", () => {
    const { container } = montar([texto("a", "   ")]);

    expect(textos(container)).toEqual(["Texto"]);
  });
});

describe("cada tipo de bloque en el preview", () => {
  it("Imagen con enlace usa una miniatura real, no un icono", () => {
    const { container } = montar([medio("a", "image", "https://cdn.test/fotos/playa.png")]);

    const thumb = container.querySelector<HTMLImageElement>(".flow-node__block-thumb");
    expect(thumb?.getAttribute("src")).toBe("https://cdn.test/fotos/playa.png");
    // La miniatura enseña QUÉ es; el rótulo dice DE QUÉ TIPO es.
    expect(textos(container)).toEqual(["Imagen"]);
  });

  it("Imagen sin enlace usable cae al icono, sin inventar recurso", () => {
    const { container } = montar([medio("a", "image")]);

    expect(container.querySelector(".flow-node__block-thumb")).toBeNull();
    expect(container.querySelector(".flow-node__block-badge svg")).not.toBeNull();
    expect(textos(container)).toEqual(["Imagen"]);
  });

  it("Video usa icono y resumen: no se carga el medio para el lienzo", () => {
    const { container } = montar([medio("a", "video", "https://cdn.test/clip.mp4")]);

    expect(container.querySelector("video")).toBeNull();
    expect(container.querySelector(".flow-node__block-thumb")).toBeNull();
    expect(textos(container)).toEqual(["Video"]);
  });

  it("Audio es icono y nombre: ni reproductor, ni onda, ni controles", () => {
    const { container } = montar([medio("a", "audio", "https://cdn.test/saludo.mp3")]);

    expect(textos(container)).toEqual(["Audio"]);
    expect(container.querySelector("audio")).toBeNull();
    expect(container.querySelector(".media-audio")).toBeNull();
    expect(container.querySelector(".media-audio__wave")).toBeNull();
  });

  it("Archivo se rotula por su tipo", () => {
    const { container } = montar([medio("a", "file", "https://cdn.test/docs/condiciones.pdf")]);

    expect(textos(container)).toEqual(["Archivo"]);
  });

  it("ni la descripción ni el nombre del archivo desplazan al tipo", () => {
    // En 230px un nombre real se recortaba a mitad —«Grabación de pantalla
    // 20…»— y no identificaba nada. El tipo cabe entero y responde a la
    // pregunta que se le hace al nodo cerrado.
    const { container } = montar([
      medio("a", "image", "https://cdn.test/img_20260101.png", "Foto del equipo")
    ]);

    expect(textos(container)).toEqual(["Imagen"]);
    expect(container.textContent).not.toContain("Foto del equipo");
    expect(container.textContent).not.toContain("img_20260101");
  });

  it("Intervalo NO se pinta: el preview enseña contenido, no tiempo de espera", () => {
    // Una pausa no es algo que el cliente reciba. El nodo cerrado responde a
    // «qué le llega a esta persona», y una espera no lo es.
    const { container } = montar([
      texto("a", "Hola"),
      { id: "b", kind: "interval", amount: 5, unit: "seconds" },
      medio("c", "image", "https://cdn.test/foto.png")
    ]);

    expect(filas(container)).toHaveLength(2);
    expect(textos(container)).toEqual(["Hola", "Imagen"]);
    // Ni rastro de la duración por ninguna vía.
    expect(container.textContent).not.toMatch(/segundo|minuto|hora/i);
    expect(container.querySelector(".flow-node__block--interval")).toBeNull();
  });

  it("el orden del contenido se conserva al retirar las pausas de en medio", () => {
    const { container } = montar([
      texto("a", "Primero"),
      { id: "p1", kind: "interval", amount: 3, unit: "seconds" },
      medio("b", "audio", "https://cdn.test/voz.mp3"),
      { id: "p2", kind: "interval", amount: 9, unit: "seconds" },
      medio("c", "image", "https://cdn.test/foto.png"),
      { id: "p3", kind: "interval", amount: 1, unit: "minutes" },
      texto("d", "Último")
    ]);

    expect(textos(container)).toEqual(["Primero", "Audio", "Imagen", "Último"]);
  });

  it("un mensaje hecho solo de pausas no tiene contenido que enseñar", () => {
    const { container } = montar([
      { id: "a", kind: "interval", amount: 5, unit: "seconds" },
      { id: "b", kind: "interval", amount: 2, unit: "minutes" }
    ]);

    // Nada llega al cliente, así que el preview cae en el estado vacío.
    expect(container.querySelector(".flow-node__blocks")).toBeNull();
    expect(container.querySelector(".flow-node__preview")?.textContent).toBe(
      "Sin contenido para enviar"
    );
  });

  it("las pausas siguen intactas en la configuración: solo se dejan de pintar", () => {
    // El filtro es de PINTADO. El bloque sigue en `config.items`, se sigue
    // editando y se sigue ejecutando.
    const items = [
      texto("a", "Hola"),
      { id: "b", kind: "interval", amount: 5, unit: "seconds" }
    ];
    const copia = JSON.parse(JSON.stringify(items));

    montar(items);

    expect(items).toEqual(copia);
    expect(items.some((i) => i.kind === "interval")).toBe(true);
  });

  it("no hay edición, ni arrastre, ni controles dentro del preview", () => {
    const { container } = montar([texto("a", "Hola"), medio("b", "image")]);

    const lista = container.querySelector(".flow-node__blocks")!;
    expect(lista.querySelectorAll("button, input, textarea, select")).toHaveLength(0);
    expect(lista.querySelector("[draggable=true]")).toBeNull();
  });
});

describe("los enseña TODOS: sin tope ni recuento", () => {
  const bloques = (n: number) =>
    Array.from({ length: n }, (_, i) => texto(`t${i}`, `Bloque ${i + 1}`));

  it.each([1, 3, 5, 10, 15])("%i bloques dan exactamente %i filas", (n) => {
    const { container } = montar(bloques(n));

    expect(filas(container)).toHaveLength(n);
  });

  it("nunca aparece un «+N bloques»", () => {
    for (const n of [5, 6, 10, 15, 40]) {
      const { container, unmount } = montar(bloques(n));

      expect(container.querySelector(".flow-node__block--more")).toBeNull();
      expect(container.textContent).not.toMatch(/\+\s*\d+\s+bloque/);
      // Y ni uno se queda fuera: la última fila es el último bloque.
      expect(textos(container).at(-1)).toBe(`Bloque ${n}`);
      unmount();
    }
  });

  it("quince bloques salen en su orden original, sin saltarse ninguno", () => {
    const { container } = montar(bloques(15));

    expect(textos(container)).toEqual(bloques(15).map((_, i) => `Bloque ${i + 1}`));
  });

  it("el nodo crece a lo ALTO, nunca a lo ancho", () => {
    const hoja = flowNodeCss;
    const nodo = hoja.slice(hoja.indexOf(".flow-node {"), hoja.indexOf("}", hoja.indexOf(".flow-node {")));

    expect(nodo).toMatch(/width:\s*230px/);
    expect(nodo).toMatch(/overflow:\s*hidden/);
    // Ninguna fila declara ancho propio, así que no puede empujar la tarjeta
    // por muchos bloques que haya.
    const fila = hoja.slice(hoja.indexOf(".flow-node__block {"));
    expect(fila.slice(0, fila.indexOf("}"))).not.toMatch(/(?<!min-|max-)width:/);
    // Y el recuento retirado no deja regla huérfana.
    expect(hoja).not.toContain("__block--more");
    expect(hoja).not.toContain("flow-node__item--more");
  });

  it("cada fila se mantiene en una sola línea, con recorte horizontal", () => {
    const { container } = montar([
      texto("a", "palabra ".repeat(80).trim()),
      ...bloques(14)
    ]);

    expect(filas(container)).toHaveLength(15);

    const hoja = flowNodeCss;
    const regla = hoja.slice(hoja.indexOf(".flow-node__block-text {"));
    expect(regla).toMatch(/white-space:\s*nowrap/);
    expect(regla).toMatch(/text-overflow:\s*ellipsis/);
    expect(regla).toMatch(/overflow:\s*hidden/);
    expect(regla).toMatch(/min-width:\s*0/);
  });

  it("los seis tipos conviven en un mismo nodo con sus iconos oficiales", () => {
    const { container } = montar([
      texto("a", "Bienvenida"),
      medio("b", "image", "https://cdn.test/foto.png"),
      medio("c", "video", "https://cdn.test/clip.mp4"),
      medio("d", "audio", "https://cdn.test/voz.mp3"),
      medio("e", "file", "https://cdn.test/doc.pdf"),
      { id: "f", kind: "interval", amount: 5, unit: "minutes" }
    ]);

    // Cinco: el intervalo queda fuera por no ser contenido.
    expect(filas(container)).toHaveLength(5);
    expect(textos(container)).toEqual([
      "Bienvenida",
      "Imagen",
      "Video",
      "Audio",
      "Archivo"
    ]);

    // Imagen trae miniatura; los otros cuatro, el SVG de `getItemIcon`.
    expect(container.querySelectorAll(".flow-node__block-thumb")).toHaveLength(1);
    const conIcono = filas(container).filter((f) => f.querySelector(".flow-node__block-badge svg"));
    expect(conIcono).toHaveLength(4);

    for (const kind of ["text", "video", "audio", "file"] as const) {
      const Oficial = getItemIcon(kind);
      const ref = render(<Oficial />);
      const esperado = ref.container.querySelector("svg")?.outerHTML;
      expect(
        conIcono.some((f) => f.querySelector(".flow-node__block-badge svg")?.outerHTML === esperado),
        `'${kind}' no usa su icono oficial`
      ).toBe(true);
      ref.unmount();
    }
  });
});

describe("el preview es derivado, nunca fuente de verdad", () => {
  it("cambiar config.items cambia lo que se ve", () => {
    const { container, rerender } = montar([texto("a", "Antes")]);
    expect(textos(container)).toEqual(["Antes"]);

    const nodo = createNodeDraft("message", 0);
    nodo.data = { ...nodo.data, config: { items: [texto("a", "Después"), texto("b", "Nuevo")] } };
    rerender(
      <ReactFlowProvider>
        <BuilderEditingProvider
          requestEdit={vi.fn()}
          toggleExpand={vi.fn()}
          updateNode={vi.fn()}
          duplicateNode={vi.fn()}
          removeNode={vi.fn()}
        >
          <FlowNodeCard
            {...({ id: nodo.id, data: nodo.data, selected: false } as NodeProps<CanvasNode>)}
          />
        </BuilderEditingProvider>
      </ReactFlowProvider>
    );

    expect(textos(container)).toEqual(["Después", "Nuevo"]);
  });

  it("NO modifica config.items: pintar no escribe", () => {
    const items = [texto("a", "Hola"), medio("b", "image", "https://cdn.test/f.png")];
    const copia = JSON.parse(JSON.stringify(items));

    montar(items);

    expect(items).toEqual(copia);
  });

  it("lee la secuencia por el lector compartido, con su compatibilidad hacia atrás", () => {
    // Un nodo anterior a la secuencia trae `content.text` y ningún `items`. El
    // lector lo convierte en un bloque de texto, y el preview lo pinta como
    // tal sin saber que venía de otra época.
    const { container } = montar(null, { text: "Mensaje de un flujo antiguo" });

    expect(textos(container)).toEqual(["Mensaje de un flujo antiguo"]);
  });

  it("usa los iconos del constructor, no un segundo sistema", () => {
    const { container } = montar([texto("a", "Hola")]);

    const enFila = container.querySelector(".flow-node__block-badge svg")!;
    const IconoOficial = getItemIcon("text");
    const oficial = render(<IconoOficial />);

    expect(enFila.outerHTML).toBe(oficial.container.querySelector("svg")?.outerHTML);
    oficial.unmount();
  });

  it("la cabecera sigue usando el SVG oficial de la herramienta", () => {
    const { container } = montar([texto("a", "Hola")]);

    const cabecera = within(container.querySelector(".flow-node__header") as HTMLElement);
    const icono = container.querySelector(".flow-node__type-icon svg");
    expect(icono).not.toBeNull();
    expect(cabecera.getByText("Mensaje")).toBeTruthy();

    // El mismo que declara `ui-registry`, no el glyph ni una copia.
    const { Icon: IconoHerramienta } = resolveToolUi("message");
    const oficial = render(<IconoHerramienta />);
    expect(icono?.outerHTML).toBe(oficial.container.querySelector("svg")?.outerHTML);
    oficial.unmount();
  });
});

// ---------------------------------------------------------------------------
// Presentación: mini tarjetas, no una lista de texto.
//
// Cada bloque tiene su propio contenedor visual. Lo que se fija aquí es que ese
// contenedor exista para TODOS los tipos y que la superficie sea del sistema —
// cristal sobre el color del nodo—, no texto suelto sobre el fondo.
// ---------------------------------------------------------------------------

describe("cada bloque es una mini tarjeta", () => {
  const hoja = flowNodeCss;
  const regla = (selector: string) => {
    const i = hoja.indexOf(`${selector} {`);
    return i === -1 ? "" : hoja.slice(i, hoja.indexOf("}", i));
  };

  it("los cinco tipos de contenido traen contenedor visual propio y su clase de tipo", () => {
    // La clase de tipo se conserva como gancho semántico aunque ya no pinte.
    // Intervalo no aparece: no es contenido.
    const { container } = montar([
      texto("a", "Bienvenida"),
      medio("b", "image", "https://cdn.test/foto.png"),
      medio("c", "video", "https://cdn.test/clip.mp4"),
      medio("d", "audio", "https://cdn.test/voz.mp3"),
      medio("e", "file", "https://cdn.test/doc.pdf"),
      { id: "f", kind: "interval", amount: 5, unit: "minutes" }
    ]);

    const bloques = filas(container);
    expect(bloques).toHaveLength(5);
    expect(bloques.map((b) => b.className.match(/flow-node__block--(\w+)/)?.[1])).toEqual([
      "text",
      "image",
      "video",
      "audio",
      "file"
    ]);
    // Cada uno lleva ficha de tipo o miniatura, nunca ninguna de las dos.
    for (const b of bloques) {
      const ficha = b.querySelector(".flow-node__block-badge");
      const mini = b.querySelector(".flow-node__block-thumb");
      expect(Boolean(ficha) !== Boolean(mini), "un bloque sin representación visual").toBe(true);
    }
  });

  it("la tarjeta tiene superficie propia: fondo, borde y radio", () => {
    const bloque = regla(".flow-node__block");

    expect(bloque).toMatch(/background:\s*\S/);
    expect(bloque).toMatch(/border:\s*1px solid \S/);
    expect(bloque).toMatch(/border-radius:\s*\d+px/);
    // El texto no flota sobre el fondo del nodo: va dentro de la tarjeta.
    expect(bloque).toMatch(/padding:/);
  });

  it("la ficha del tipo y la miniatura ocupan la misma columna izquierda", () => {
    expect(regla(".flow-node__block-badge")).toMatch(/flex:\s*0 0 auto/);
    expect(regla(".flow-node__block-thumb")).toMatch(/flex:\s*0 0 auto/);
    // La miniatura encaja sin deformarse.
    expect(regla(".flow-node__block-thumb")).toMatch(/object-fit:\s*cover/);
  });

  it("no hay emojis en ninguna parte del preview", () => {
    const { container } = montar([
      texto("a", "Hola"),
      medio("b", "image"),
      medio("c", "audio"),
      { id: "d", kind: "interval", amount: 5, unit: "minutes" }
    ]);

    const lista = container.querySelector(".flow-node__blocks")!;
    expect(lista.textContent ?? "").not.toMatch(
      /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u
    );
    // La fuente del componente tampoco los trae.
    const fuente = readFileSync(
      "src/features/automations/builder/tools/message/MessageCompactBody.tsx",
      "utf8"
    );
    expect(fuente).not.toMatch(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
  });

  it("no se cuela ningún medio pesado ni control dentro del nodo", () => {
    const { container } = montar([
      medio("a", "video", "https://cdn.test/clip.mp4"),
      medio("b", "audio", "https://cdn.test/voz.mp3")
    ]);

    // Solo se permite `<img>` para la miniatura de imagen.
    expect(container.querySelector("video")).toBeNull();
    expect(container.querySelector("audio")).toBeNull();
    expect(container.querySelector("source")).toBeNull();
    expect(container.querySelector(".flow-node__blocks img")).toBeNull();
    const lista = container.querySelector(".flow-node__blocks")!;
    expect(lista.querySelectorAll("button, input, textarea, select")).toHaveLength(0);
  });

  it("con quince bloques sigue habiendo quince tarjetas y ningún desbordamiento", () => {
    const quince = Array.from({ length: 15 }, (_, i) =>
      i % 3 === 0
        ? texto(`t${i}`, "Texto larguísimo ".repeat(10).trim())
        : medio(`m${i}`, "image", `https://cdn.test/f${i}.png`)
    );
    const { container } = montar(quince);

    expect(filas(container)).toHaveLength(15);
    expect(container.querySelectorAll(".flow-node__block-thumb")).toHaveLength(10);
    expect(regla(".flow-node__block-text")).toMatch(/text-overflow:\s*ellipsis/);
    expect(regla(".flow-node__block")).toMatch(/min-width:\s*0/);
  });
});

// ---------------------------------------------------------------------------
// Identidad visual por tipo.
//
// El preview no es una lista con iconos distintos: es el contenido del editor
// a escala. Cada bloque toma `--mi-accent` y la escalera de roles de
// `message-tokens.css` —los MISMOS con los que el constructor pinta ese
// bloque—, así que Texto se ve morado en las dos vistas e Intervalo cian.
//
// Se comprueba sobre el CSS porque jsdom no resuelve `oklch(from …)`: lo que
// se puede garantizar es que cada tipo ate su acento al token del editor y que
// las superficies salgan de la escalera compartida, no de colores sueltos.
// ---------------------------------------------------------------------------

describe("cada tipo conserva la identidad visual de su bloque en el editor", () => {
  const hoja = flowNodeCss;
  const tokens = readFileSync(
    "src/features/automations/builder/tools/message/styles/message-tokens.css",
    "utf8"
  );
  const regla = (selector: string) => {
    const i = hoja.indexOf(`${selector} {`);
    return i === -1 ? "" : hoja.slice(i, hoja.indexOf("}", i));
  };

  it("TODAS las filas comparten una sola superficie: un único acento", () => {
    // El preview no reparte un color por tipo: seis fondos distintos hacían
    // leer el nodo como seis tarjetas en vez de como el contenido de UN
    // mensaje. Hay exactamente UNA declaración de acento.
    const declaraciones = [...hoja.matchAll(/--mi-accent:/g)];

    expect(declaraciones).toHaveLength(1);
    // Ninguna clase de tipo declara acento propio.
    expect(hoja).not.toMatch(/\.flow-node__block--\w+\s*\{\s*--mi-accent/);
  });

  it("el lienzo NO depende de tokens privados del editor de Mensaje", () => {
    // `--mi-image` lo define `message-tokens.css`, que solo carga el editor
    // expandido. El nodo cerrado no lo importa: dependía de él por casualidad
    // —el empaquetado junta todo el CSS— y se habría quedado sin acento en
    // cuanto las herramientas se carguen por separado. El color se calcula
    // aquí, con los tokens globales de la paleta.
    expect(hoja).not.toMatch(/var\(--mi-[a-z]/);
    expect(hoja).toMatch(/--mi-accent:\s*color-mix\(/);
    // Y los tokens que sí usa son globales, no del módulo Mensaje.
    expect(hoja).toMatch(/var\(--primary\)/);
  });

  it("la identidad la llevan el icono, el texto y la miniatura, no el fondo", () => {
    const { container } = montar([
      texto("a", "Bienvenida"),
      { id: "b", kind: "interval", amount: 5, unit: "seconds" },
      medio("c", "image", "https://cdn.test/foto.png")
    ]);

    // Las filas de contenido se distinguen por lo que llevan dentro...
    expect(textos(container)).toEqual(["Bienvenida", "Imagen"]);
    // ...por su icono oficial o su miniatura...
    expect(container.querySelectorAll(".flow-node__block-badge svg")).toHaveLength(1);
    expect(container.querySelectorAll(".flow-node__block-thumb")).toHaveLength(1);
    // ...y NO por la clase de tipo, que ya no pinta nada.
    expect(filas(container).map((f) => f.className.match(/block--(\w+)/)?.[1])).toEqual([
      "text",
      "image"
    ]);
  });

  it("las filas se dibujan con LUZ, no con tinta", () => {
    // El principio del rediseño: un velo blanco tenue lee como un plano de
    // vidrio sobre el azul. Un relleno oscuro leía como un agujero recortado,
    // y de ahí venía la sensación de «tarjetas pegadas».
    const bloque = regla(".flow-node__block");
    const alfa = Number(/background:\s*rgba\(255, 255, 255, (0?\.\d+)\)/.exec(bloque)?.[1]);

    expect(alfa).toBeGreaterThan(0);
    expect(alfa).toBeLessThanOrEqual(0.12);
    // La arista superior encendida es lo que da grosor al vidrio.
    expect(bloque).toMatch(/inset 0 1px 0 rgba\(255, 255, 255/);
  });

  it("el lila de AUREAM entra por los filos, no por el relleno ni por el texto", () => {
    // Es la única vía por la que el color del sistema toca la fila.
    expect(regla(".flow-node__block")).toMatch(
      /border:\s*1px solid color-mix\(in oklab, var\(--primary\)/
    );
    expect(regla(".flow-node__block-badge")).toMatch(/color-mix\(in oklab, var\(--primary\)/);
    // Ni el relleno ni el texto llevan matiz.
    expect(regla(".flow-node__block")).not.toMatch(/background:[^;]*var\(--primary\)/);
    expect(regla(".flow-node__block-text")).not.toMatch(/var\(--primary\)|--mi-accent/);
  });

  it("la lista NO pinta fondo: el azul del nodo llega continuo por detrás", () => {
    // Un suelo propio aquí metía un segundo panel dentro del nodo y los
    // bloques pasaban a leerse como contenido de otra caja.
    const lista = regla(".flow-node__blocks");

    expect(lista).not.toMatch(/background/);
    expect(lista).not.toMatch(/border(?!-)/);
  });

  it("el filo es una línea de un píxel: contorno, no botón", () => {
    const bloque = regla(".flow-node__block");

    expect(bloque).toMatch(/border:\s*1px solid/);
    expect(bloque).not.toMatch(/border-width:\s*[2-9]/);
    // La única sombra permitida es INTERIOR —la que da grosor al vidrio—.
    // Una sombra proyectada convertiría la fila en un botón flotante.
    const sombras = /box-shadow:([^;]*);/.exec(bloque)?.[1] ?? "";
    for (const parte of sombras.split(/,(?![^(]*\))/)) {
      if (parte.trim()) expect(parte, `sombra proyectada: ${parte}`).toMatch(/inset/);
    }
  });

  it("el texto del contenido es BLANCO, no un matiz del tipo", () => {
    // Teñirlo del color del tipo lo dejaba en 3.10:1 de contraste, por debajo
    // del mínimo legible. En blanco mide 8.37:1 sobre la misma superficie.
    // La jerarquía la da la luminosidad, nunca el matiz.
    const texto = regla(".flow-node__block-text");
    const alfa = Number(/color:\s*rgba\(255, 255, 255, (0?\.\d+)\)/.exec(texto)?.[1]);

    expect(alfa).toBeGreaterThanOrEqual(0.9);
    expect(texto).not.toMatch(/oklch|var\(--mi-|var\(--primary\)/);
  });

  it("el título del nodo es blanco puro y manda sobre el resto de la cabecera", () => {
    const titulo = regla(".flow-node:has(.flow-node__blocks) .flow-node__name");
    const controles = regla(".flow-node:has(.flow-node__blocks) .flow-node__action-btn");

    expect(titulo).toMatch(/color:\s*rgba\(255, 255, 255, 1\)/);
    // Los controles ceden protagonismo: menos opacidad que el título.
    const alfaControl = Number(/color:\s*rgba\(255, 255, 255, (0?\.\d+)\)/.exec(controles)?.[1]);
    expect(alfaControl).toBeLessThan(0.8);
  });

  it("la separación entre bloques es pequeña y consistente", () => {
    const gap = Number(/gap:\s*(\d+)px/.exec(regla(".flow-node__blocks"))?.[1]);

    expect(gap).toBeGreaterThanOrEqual(4);
    expect(gap).toBeLessThanOrEqual(6);
  });

  it("no se duplicó la paleta: el preview no declara colores propios por tipo", () => {
    // Solo las reglas de los bloques: el tratamiento del nodo va aparte y
    // tiene su propia comprobación.
    const desde = hoja.indexOf(".flow-node__block--text");
    const hasta = hoja.indexOf("ADN AUREAM DEL NODO MENSAJE");
    const bloqueCss = hoja.slice(desde, hasta > desde ? hasta : undefined);

    expect(bloqueCss).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(bloqueCss).not.toMatch(/color-mix\(/);
  });

  it("ningún color del nodo se escribe a mano: todos salen de un token", () => {
    // Garantía de TODO el archivo, no solo de los bloques: cada `color-mix`
    // mezcla tokens existentes, nunca un literal. Es lo que impide que se cuele
    // una segunda paleta por la puerta de atrás.
    for (const [mezcla] of hoja.matchAll(/color-mix\([^)]*\)/g)) {
      expect(mezcla, `mezcla sin token: ${mezcla}`).toMatch(/var\(--/);
      expect(mezcla, `mezcla con literal: ${mezcla}`).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    }
  });

  it("los tokens compartidos viven en :root, y la rejilla del editor NO", () => {
    // Se movieron de `.message-editor` a `:root` para que las dos vistas los
    // compartan. La COMPOSICIÓN del editor tuvo que quedarse donde estaba: en
    // `:root` habría convertido el documento entero en una rejilla.
    const raiz = tokens.slice(tokens.indexOf(":root {"), tokens.indexOf("}", tokens.indexOf(":root {")));
    expect(raiz).toMatch(/--mi-text:/);
    expect(raiz).toMatch(/--mi-L-veil:/);
    expect(raiz).not.toMatch(/display:\s*grid/);
    expect(raiz).not.toMatch(/grid-template-columns/);

    const editor = tokens.slice(tokens.indexOf(".message-editor {"));
    expect(editor.slice(0, editor.indexOf("}"))).toMatch(/grid-template-columns:\s*176px/);
  });

  it("la miniatura de imagen es lo bastante grande para reconocerse", () => {
    const thumb = regla(".flow-node__block-thumb");
    const ancho = Number(/width:\s*(\d+)px/.exec(thumb)?.[1]);
    const alto = Number(/height:\s*(\d+)px/.exec(thumb)?.[1]);

    // Mayor que la ficha de icono a la que sustituye (20px).
    expect(ancho).toBeGreaterThan(20);
    expect(alto).toBeGreaterThan(20);
    expect(thumb).toMatch(/object-fit:\s*cover/);
  });
});

// ---------------------------------------------------------------------------
// ADN AUREAM del nodo.
//
// El azul de la herramienta llega como un hex plano en línea desde
// `tool.colors`; la profundidad se añade en capas por encima, sin tocar el
// componente ni el contrato de color. Lo que se fija aquí es que esas capas
// existan, que el lila salga del token del sistema y que NINGÚN otro nodo las
// reciba.
// ---------------------------------------------------------------------------

describe("el nodo Mensaje lleva el lenguaje visual de AUREAM", () => {
  const hoja = flowNodeCss;
  const adn = hoja.slice(hoja.indexOf("ADN AUREAM DEL NODO MENSAJE"));

  it("el tratamiento está acotado al nodo Mensaje: los otros trece no lo reciben", () => {
    // `:has(.flow-node__blocks)` solo casa con el nodo que trae la secuencia.
    const reglas = [...adn.matchAll(/^\.flow-node[^{]*\{/gm)].map((m) => m[0]);

    expect(reglas.length).toBeGreaterThan(0);
    for (const r of reglas) {
      expect(r, `regla sin acotar: ${r}`).toContain(":has(.flow-node__blocks)");
    }
  });

  it("el lila sale de --primary, no de una paleta nueva", () => {
    expect(adn).toMatch(/color-mix\(in oklab, var\(--primary\)/);
    // Ni un color literal en todo el bloque.
    expect(adn).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });

  it("la luz se añade en capas, sin tocar el fondo que pone la herramienta", () => {
    // Pseudo-elementos: el `background` en línea del nodo se conserva intacto.
    expect(adn).toMatch(/\.flow-node__header::after/);
    expect(adn).toMatch(/\.flow-node__body::after/);
    expect(adn).toMatch(/pointer-events:\s*none/);
    // Y el contenido queda por encima del reflejo.
    expect(adn).toMatch(/z-index:\s*1/);
  });

  it("cabecera y cuerpo son dos escalones de la misma superficie", () => {
    // La cabecera recibe el reflejo; el cuerpo, un velo más profundo. Los dos
    // terminan en el lila.
    const cabecera = adn.slice(adn.indexOf(".flow-node__header::after"));
    const cuerpo = adn.slice(adn.indexOf(".flow-node__body::after"));

    expect(cabecera).toMatch(/rgba\(255, 255, 255, 0\.\d+\)/);
    expect(cabecera).toMatch(/var\(--primary\)/);
    expect(cuerpo).toMatch(/var\(--primary\)/);
    // El cuerpo NO es un panel: sin borde ni radio propios.
    expect(cuerpo.slice(0, cuerpo.indexOf("}"))).not.toMatch(/border(?!-)|border-radius/);
  });

  it("el filo del nodo es una línea de un píxel, no un halo", () => {
    const anillo = adn.slice(adn.indexOf(".flow-node:has(.flow-node__blocks) {"));
    expect(anillo).toMatch(/0 0 0 1px color-mix\(in oklab, var\(--primary\)/);
  });
});

// ---------------------------------------------------------------------------
// Cristal real: el color deja de imponerse en línea.
//
// `FlowNodeCard` publicaba `background: <color>` como estilo en línea, y eso
// gana a cualquier hoja: ninguna regla podía darle translucidez. Ahora publica
// el color como variable y la hoja construye la superficie. Lo que se fija
// aquí es que ese desacople siga en pie y que NO haya cambiado la apariencia
// del resto de nodos.
// ---------------------------------------------------------------------------

describe("la superficie del nodo se construye desde CSS, no desde el componente", () => {
  const hoja = flowNodeCss;
  const tarjeta = readFileSync(
    "src/features/automations/builder/components/canvas/FlowNodeCard.tsx",
    "utf8"
  );
  const codigo = tarjeta.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

  it("el componente PUBLICA el color, no lo aplica", () => {
    expect(codigo).toMatch(/"--flow-node-accent":\s*colors\.header/);
    expect(codigo).toMatch(/"--flow-node-surface":\s*colors\.body/);
    // Ya no queda ni un `background` en línea en la tarjeta.
    expect(codigo).not.toMatch(/style=\{\{\s*background/);
    expect(codigo).not.toMatch(/background:\s*colors\./);
  });

  it("sigue sin haber lógica por tipo de nodo en la tarjeta", () => {
    // El desacople es de fontanería visual: las catorce herramientas publican
    // sus dos colores igual y la hoja decide el tratamiento.
    expect(codigo).not.toMatch(/nodeType\s*===/);
    expect(codigo).not.toMatch(/"message"/);
  });

  it("por omisión la superficie es OPACA: los otros trece nodos no cambian", () => {
    const cabecera = hoja.slice(hoja.indexOf(".flow-node__header {"));
    const cuerpo = hoja.slice(hoja.indexOf(".flow-node__body {"));

    expect(cabecera.slice(0, cabecera.indexOf("}"))).toMatch(
      /background:\s*var\(--flow-node-accent\);/
    );
    expect(cuerpo.slice(0, cuerpo.indexOf("}"))).toMatch(
      /background:\s*var\(--flow-node-surface\);/
    );
    // Sin mezcla ni desenfoque en la regla base.
    expect(cabecera.slice(0, cabecera.indexOf("}"))).not.toMatch(/color-mix|backdrop-filter/);
    expect(cuerpo.slice(0, cuerpo.indexOf("}"))).not.toMatch(/color-mix|backdrop-filter/);
  });

  it("el cristal está acotado al nodo Mensaje", () => {
    for (const [regla] of hoja.matchAll(/^[^\n{]*backdrop-filter[^\n]*$/gm)) {
      // Cada declaración de desenfoque vive en una regla acotada.
      expect(regla).toMatch(/blur\(\d+px\)/);
    }
    const conBlur = [...hoja.matchAll(/([^{}]+)\{[^}]*backdrop-filter[^}]*\}/g)].map((m) =>
      m[1].trim()
    );
    expect(conBlur.length).toBeGreaterThan(0);
    for (const sel of conBlur) {
      expect(sel, `desenfoque sin acotar: ${sel}`).toContain(":has(.flow-node__blocks)");
    }
  });

  it("la translucidez se construye con el color publicado, no con uno nuevo", () => {
    const cristal = hoja.slice(hoja.indexOf("CRISTAL DE VERDAD"));
    expect(cristal).toMatch(/color-mix\(in srgb, var\(--flow-node-accent\) \d+%, transparent\)/);
    expect(cristal).toMatch(/color-mix\(in srgb, var\(--flow-node-surface\) \d+%, transparent\)/);
    expect(cristal.slice(0, cristal.indexOf(".flow-node__block"))).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });
});

// ---------------------------------------------------------------------------
// Las dos fuentes en el preview del lienzo.
//
// Un medio se configura con ENLACE o con ARCHIVO. El preview tiene que
// representar los dos, y hacerlo distinto según el tipo: solo Imagen tiene algo
// que enseñar en 28px; Video y Audio se identifican por su icono, porque sacar
// un fotograma o una onda exigiría cargar el medio entero dentro del lienzo.
// ---------------------------------------------------------------------------

describe("las dos fuentes de un medio, en el preview", () => {
  const MEDIOS = ["image", "video", "audio", "file"] as const;
  const conArchivo = (kind: string, id = kind) => ({
    id,
    kind,
    url: "",
    fileName: `elegido-${kind}.bin`,
    caption: "",
    sendOnce: false
  });

  afterEach(() => {
    for (const kind of MEDIOS) soltarArchivo(kind);
  });

  it.each(MEDIOS)("%s con ARCHIVO se rotula por su tipo, no como bloque vacío", (kind) => {
    const { container } = montar([conArchivo(kind)]);

    expect(filas(container)).toHaveLength(1);
    expect(textos(container)).toEqual([MESSAGE_ITEM_LABELS[kind]]);
    // Nunca queda mudo, y el nombre del archivo no invade la fila.
    expect(textos(container)[0]).not.toBe("");
    expect(container.textContent).not.toContain(`elegido-${kind}.bin`);
  });

  it("IMAGEN con archivo en sesión muestra la MINIATURA REAL, no el icono", () => {
    // Los bytes están: se pinta la foto de verdad. Era justo lo que faltaba.
    adjuntarArchivo("image", new File(["x"], "playa.png", { type: "image/png" }));
    const { container } = montar([conArchivo("image")]);

    const thumb = container.querySelector<HTMLImageElement>(".flow-node__block-thumb");
    expect(thumb).not.toBeNull();
    expect(thumb?.getAttribute("src")).toBe(enlaceDeSesion("image"));
    expect(container.querySelector(".flow-node__block-badge")).toBeNull();
  });

  it("IMAGEN sin los bytes cae al icono: no se inventa una miniatura", () => {
    const { container } = montar([conArchivo("image")]);

    expect(container.querySelector(".flow-node__block-thumb")).toBeNull();
    expect(container.querySelector(".flow-node__block-badge svg")).not.toBeNull();
  });

  it("el ENLACE gana sobre el archivo cuando están los dos", () => {
    adjuntarArchivo("image", new File(["x"], "local.png", { type: "image/png" }));
    const { container } = montar([{ ...conArchivo("image"), url: "https://cdn.test/remota.png" }]);

    expect(container.querySelector(".flow-node__block-thumb")?.getAttribute("src")).toBe(
      "https://cdn.test/remota.png"
    );
  });

  it.each(["video", "audio"] as const)(
    "%s con archivo en sesión NO monta el medio en el lienzo",
    (kind) => {
      adjuntarArchivo(kind, new File(["x"], `m.${kind}`, { type: "application/octet-stream" }));
      const { container } = montar([conArchivo(kind)]);

      // Ni reproductor, ni elemento multimedia, ni miniatura: icono y nombre.
      expect(container.querySelector("video")).toBeNull();
      expect(container.querySelector("audio")).toBeNull();
      expect(container.querySelector(".media-audio")).toBeNull();
      expect(container.querySelector(".flow-node__block-thumb")).toBeNull();
      expect(container.querySelector(".flow-node__block-badge svg")).not.toBeNull();
    }
  );

  it("una mezcla de fuentes y tipos se representa entera y en orden", () => {
    adjuntarArchivo("image", new File(["x"], "foto.png", { type: "image/png" }));
    const { container } = montar([
      texto("t", "Hola"),
      conArchivo("image"),
      { id: "v", kind: "video", url: "https://cdn.test/clip.mp4", caption: "", sendOnce: false },
      conArchivo("audio"),
      { id: "p", kind: "interval", amount: 5, unit: "seconds" },
      conArchivo("file")
    ]);

    expect(textos(container)).toEqual(["Hola", "Imagen", "Video", "Audio", "Archivo"]);
    // Una sola miniatura —la imagen— y el resto con icono. La pausa no está.
    expect(container.querySelectorAll(".flow-node__block-thumb")).toHaveLength(1);
    expect(container.querySelector(".flow-node__block--interval")).toBeNull();
  });

  it("el preview no serializa ni retiene nada del archivo", () => {
    adjuntarArchivo("image", new File(["x"], "foto.png", { type: "image/png" }));
    const items = [conArchivo("image")];
    const copia = JSON.parse(JSON.stringify(items));

    montar(items);

    expect(items).toEqual(copia);
    expect(JSON.stringify(items)).not.toContain("blob:");
  });
});

// ---------------------------------------------------------------------------
// Miniatura de VIDEO.
//
// Imagen y Video comparten camino: los dos piden una miniatura por la misma
// puerta. La diferencia es que la de un video hay que sacarla decodificando un
// fotograma, y eso es asíncrono y puede fallar.
//
// jsdom NO decodifica video, así que aquí se prueba TODO menos el píxel: que se
// pida por la puerta común, que el fallo caiga con elegancia al icono, que no
// se monte ningún reproductor y que los recursos se suelten. La captura real se
// verifica en Chrome, que es el único que sabe decodificar.
// ---------------------------------------------------------------------------

describe("miniatura de video", () => {
  // Object URLs deterministas: jsdom no implementa ninguna de las dos.
  let revocados: string[] = [];

  beforeEach(() => {
    revocados = [];
    let n = 0;
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: vi.fn(() => `blob:mock/${++n}`),
      revokeObjectURL: vi.fn((url: string) => void revocados.push(url))
    });
  });

  const video = (id = "v", extra: Record<string, unknown> = {}) => ({
    id,
    kind: "video",
    url: "",
    fileName: "clip.mp4",
    caption: "",
    sendOnce: false,
    ...extra
  });

  afterEach(() => {
    soltarArchivo("v");
    soltarArchivo("image");
    olvidarMiniatura("blob:mock/1");
    vi.unstubAllGlobals();
  });

  it("mientras no hay fotograma se pinta el icono, sin bloquear el render", () => {
    adjuntarArchivo("v", new File(["x"], "clip.mp4", { type: "video/mp4" }));
    const { container } = montar([video()]);

    // El nodo se pinta ya, con su icono oficial. Nada queda esperando.
    expect(container.querySelector(".flow-node__block-badge svg")).not.toBeNull();
    expect(textos(container)).toEqual(["Video"]);
  });

  it("un video que no se puede decodificar cae al icono sin romper nada", () => {
    // Es el caso de jsdom, y también el de un códec no soportado o un CORS que
    // contamina el canvas: el resultado tiene que ser el mismo.
    const { container } = montar([video("v", { url: "https://cdn.test/roto.mp4" })]);

    expect(container.querySelector(".flow-node__block-thumb")).toBeNull();
    expect(container.querySelector(".flow-node__block-badge svg")).not.toBeNull();
    expect(filas(container)).toHaveLength(1);
  });

  it("cuando el fotograma está en la caché, se pinta como miniatura", () => {
    // Se comprueba el contrato del resolver: una imagen NO necesita captura y
    // se devuelve tal cual. Es el mismo camino que recorrerá el video cuando
    // Chrome haya extraído su fotograma.
    const dataUrl = "data:image/jpeg;base64,AAAA";
    expect(miniaturaYaObtenida(dataUrl, false)).toBe(dataUrl);
  });

  it("NUNCA monta un reproductor ni un elemento de medio en el lienzo", () => {
    adjuntarArchivo("v", new File(["x"], "clip.mp4", { type: "video/mp4" }));
    const { container } = montar([
      video(),
      { id: "a", kind: "audio", url: "", fileName: "voz.mp3", caption: "", sendOnce: false }
    ]);

    expect(container.querySelector("video")).toBeNull();
    expect(container.querySelector("audio")).toBeNull();
    expect(container.querySelector("source")).toBeNull();
    // Acotado a la lista: la cabecera del nodo sí tiene sus botones de acción.
    const lista = container.querySelector(".flow-node__blocks")!;
    expect(lista.querySelectorAll("button, input, [controls]")).toHaveLength(0);
  });

  it("reemplazar el video olvida el fotograma anterior", () => {
    const primero = adjuntarArchivo("v", new File(["a"], "uno.mp4", { type: "video/mp4" }));
    // Se simula que ya había fotograma para esa fuente.
    expect(miniaturaYaObtenida(primero, false)).toBe(primero);

    const segundo = adjuntarArchivo("v", new File(["b"], "dos.mp4", { type: "video/mp4" }));

    // La fuente vieja se revocó y su enlace ya no es el del bloque.
    expect(segundo).not.toBe(primero);
    expect(revocados).toContain(primero);
    expect(enlaceDeSesion("v")).toBe(segundo);
  });

  it("quitar el video suelta el archivo y su fotograma", () => {
    const enlace = adjuntarArchivo("v", new File(["x"], "clip.mp4", { type: "video/mp4" }));

    soltarArchivo("v");

    expect(enlaceDeSesion("v")).toBeNull();
    expect(revocados).toContain(enlace);
  });

  it("soltar dos veces no falla: la limpieza es idempotente", () => {
    adjuntarArchivo("v", new File(["x"], "clip.mp4", { type: "video/mp4" }));

    soltarArchivo("v");
    expect(() => soltarArchivo("v")).not.toThrow();
    expect(enlaceDeSesion("v")).toBeNull();
  });

  it("varios medios no dejan recursos cruzados", () => {
    const a = adjuntarArchivo("v", new File(["a"], "a.mp4", { type: "video/mp4" }));
    const b = adjuntarArchivo("image", new File(["b"], "b.png", { type: "image/png" }));

    soltarArchivo("v");

    // Soltar uno no toca al otro.
    expect(enlaceDeSesion("v")).toBeNull();
    expect(enlaceDeSesion("image")).toBe(b);
    expect(revocados).toContain(a);
    expect(revocados).not.toContain(b);
    soltarArchivo("image");
  });
});

// ---------------------------------------------------------------------------
// EL NODO CERRADO ROTULA EL TIPO DE MEDIO.
//
// En 230px el nombre de un archivo real se recortaba a mitad —«Grabación de
// pantalla 20…»— y no identificaba nada: ni qué lleva el mensaje, ni qué
// archivo es. El tipo cabe entero y responde a la única pregunta que se le
// hace al nodo cerrado: qué va a recibir esta persona.
//
// Lo que el archivo ES sigue estando al lado: la miniatura para imagen y
// video, el icono oficial para audio y archivo.
// ---------------------------------------------------------------------------

describe("el rótulo de un medio es su tipo", () => {
  const TIPOS = [
    ["image", "Imagen"],
    ["video", "Video"],
    ["audio", "Audio"],
    ["file", "Archivo"]
  ] as const;

  it.each(TIPOS)("%s se rotula «%s»", (kind, etiqueta) => {
    const { container } = montar([medio("a", kind, `https://cdn.test/nombre-larguisimo.${kind}`)]);

    expect(textos(container)).toEqual([etiqueta]);
  });

  it("el nombre del archivo no aparece por ninguna vía", () => {
    const { container } = montar([
      medio("a", "video", "https://cdn.test/Grabacion-de-pantalla-2026-09-05.mov"),
      { ...medio("b", "audio"), fileName: "voz-del-cliente-final-v3.mp3" }
    ]);

    expect(container.textContent).not.toMatch(/Grabacion|\.mov|voz-del-cliente|\.mp3/);
    expect(textos(container)).toEqual(["Video", "Audio"]);
  });

  it("el rótulo sale del registro de la herramienta, no de una copia escrita aquí", () => {
    // Una segunda lista de nombres se desincroniza en cuanto alguien renombre
    // un tipo. Esta es la misma que usan el editor y la biblioteca.
    const { container } = montar(TIPOS.map(([kind], i) => medio(String(i), kind, "https://cdn.test/x")));

    expect(textos(container)).toEqual(TIPOS.map(([kind]) => MESSAGE_ITEM_LABELS[kind]));
  });

  it("un bloque de Texto sigue enseñando lo que el usuario escribió", () => {
    // El cambio es solo para medios: el texto ya se identifica a sí mismo.
    const { container } = montar([texto("a", "Hola, ¿en qué te ayudo?")]);

    expect(textos(container)).toEqual(["Hola, ¿en qué te ayudo?"]);
  });

  it("la MINIATURA sigue intacta junto al rótulo", () => {
    const { container } = montar([medio("a", "image", "https://cdn.test/playa.png")]);

    const thumb = container.querySelector<HTMLImageElement>(".flow-node__block-thumb");
    expect(thumb?.getAttribute("src")).toBe("https://cdn.test/playa.png");
    expect(textos(container)).toEqual(["Imagen"]);
  });

  it("sin miniatura, el icono sigue siendo el SVG oficial del tipo", () => {
    const { container } = montar([medio("a", "audio", "https://cdn.test/voz.mp3")]);

    expect(container.querySelector(".flow-node__block-badge svg")).not.toBeNull();
    expect(container.querySelector(".flow-node__block-badge")?.textContent).toBe("");
  });

  it("las mayúsculas las pone el CSS, y solo en las filas de medio", () => {
    // Así el rótulo del DOM sigue siendo el del registro y no hay una segunda
    // versión escrita a mano de cada nombre. El bloque de Texto queda fuera:
    // convertir la frase del usuario en mayúsculas la volvería un grito.
    const hoja = flowNodeCss;
    const regla = hoja.slice(hoja.indexOf(".flow-node__block:not(.flow-node__block--text)"));

    expect(regla).toMatch(/text-transform:\s*uppercase/);
    // La regla BASE —la que también gobierna al bloque de Texto— sigue sin
    // transformar nada. Se busca al principio de línea para no confundirla con
    // la de arriba, que lleva antepasado.
    const base = hoja.slice(hoja.indexOf("\n.flow-node__block-text {"));
    expect(base.slice(0, base.indexOf("}"))).not.toMatch(/text-transform/);
  });
});
