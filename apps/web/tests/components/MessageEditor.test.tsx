import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MessageEditor } from "@features/automations/builder/tools/message/MessageEditor";
import type { NodePatch } from "@features/automations/builder/services/applyNodePatch";

// ---------------------------------------------------------------------------
// Constructor de contenidos de Mensaje.
//
// El editor no guarda: propone. Por eso lo que se comprueba en cada caso es el
// PARCHE que emite, no un estado interno suyo — un editor con estado propio
// tendría una segunda verdad sobre la configuración del nodo.
//
// Se monta el editor solo, sin lienzo ni React Flow: su contrato dice que no
// los necesita, y montarlos aquí escondería el día en que dejara de ser cierto.
// ---------------------------------------------------------------------------

/** `DataTransfer` no existe en jsdom; se imita solo lo que el editor usa. */
function makeTransfer(type?: string, value?: string) {
  const datos = new Map<string, string>();
  if (type && value) datos.set(type, value);

  return {
    setData: (k: string, v: string) => void datos.set(k, v),
    getData: (k: string) => datos.get(k) ?? "",
    effectAllowed: "none",
    dropEffect: "none"
  } as unknown as DataTransfer;
}

const KIND_MIME = "application/aureum-message-kind";
const REORDER_MIME = "application/aureum-message-item";

function renderEditor(config: Record<string, unknown> = {}, content: Record<string, unknown> = {}) {
  const onChange = vi.fn<(patch: NodePatch) => void>();

  const utils = render(
    <MessageEditor draft={{ name: "Mensaje", content, config }} onChange={onChange} />
  );

  const lastPatch = () => onChange.mock.lastCall?.[0];
  const lastItems = () =>
    (lastPatch()?.config?.items ?? []) as Array<Record<string, unknown>>;

  return { ...utils, onChange, lastPatch, lastItems };
}

/** La lista del constructor. La biblioteca también son elementos de lista. */
const secuencia = () => screen.getByRole("list", { name: "Contenidos del mensaje" });

const dosTextos = {
  items: [
    { id: "a", kind: "text", text: "Hola" },
    { id: "b", kind: "text", text: "Adiós" }
  ]
};

describe("biblioteca de bloques", () => {
  it("ofrece los seis tipos, sin Contacto", () => {
    renderEditor();

    for (const label of ["Texto", "Imagen", "Video", "Audio", "Archivo", "Intervalo"]) {
      expect(screen.getByRole("button", { name: new RegExp(`^Añadir ${label}`) })).toBeTruthy();
    }
    expect(screen.queryByText("Contacto")).toBeNull();
  });

  it("cada bloque tiene un nombre accesible y un icono", () => {
    const { container } = renderEditor();

    for (const label of ["Texto", "Imagen", "Video", "Audio", "Archivo", "Intervalo"]) {
      const boton = screen.getByRole("button", { name: `Añadir ${label}` });
      expect(boton).toBeTruthy();
      // Icono propio, no un emoji ni un hueco.
      expect(boton.querySelector("svg")).not.toBeNull();
    }

    expect(container.querySelectorAll(".message-library__icon svg")).toHaveLength(6);
  });

  it("todos los bloques se presentan igual, sin marcas de desarrollo", () => {
    renderEditor();

    expect(screen.queryByText(/próximamente|pendiente|pronto|no ejecutable/i)).toBeNull();
  });

  it("la biblioteca no desplaza: queda fija mientras el constructor crece", () => {
    const muchos = {
      items: Array.from({ length: 14 }, (_, i) => ({ id: `i${i}`, kind: "text", text: `b${i}` }))
    };

    const { container } = renderEditor(muchos);

    // El scroll pertenece al constructor; la biblioteca queda fuera de él.
    const scroll = container.querySelector(".message-builder__scroll")!;
    expect(scroll.contains(container.querySelector(".message-library"))).toBe(false);
  });

  it("añade un bloque al hacer clic", () => {
    const { onChange, lastItems } = renderEditor();

    fireEvent.click(screen.getByRole("button", { name: "Añadir Texto" }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(lastItems()).toHaveLength(1);
    expect(lastItems()[0]).toMatchObject({ kind: "text", text: "" });
  });

  it("añade al final, conservando lo que ya había", () => {
    const { lastItems } = renderEditor(dosTextos);

    fireEvent.click(screen.getByRole("button", { name: /^Añadir Imagen/ }));

    expect(lastItems().map((item) => item.kind)).toEqual(["text", "text", "image"]);
  });
});

describe("arrastrar desde la biblioteca", () => {
  it("añade un bloque al soltarlo sobre el constructor vacío", () => {
    const { lastItems } = renderEditor();

    fireEvent.drop(screen.getByText(/Arrastra un bloque desde la izquierda/), {
      dataTransfer: makeTransfer(KIND_MIME, "image")
    });

    expect(lastItems()).toHaveLength(1);
    expect(lastItems()[0]).toMatchObject({ kind: "image" });
  });

  it("lo inserta en la posición donde se suelta, no siempre al final", () => {
    const { lastItems } = renderEditor(dosTextos);

    const filas = within(secuencia()).getAllByRole("listitem");
    fireEvent.dragOver(filas[0]);
    fireEvent.drop(secuencia(), { dataTransfer: makeTransfer(KIND_MIME, "audio") });

    expect(lastItems().map((item) => item.kind)).toEqual(["audio", "text", "text"]);
  });

  it("permite soltar detrás del último bloque", () => {
    const { container, lastItems } = renderEditor(dosTextos);

    // La zona de continuación es presentacional —no es un bloque— así que se
    // busca por su clase. Es la única, y va detrás de la secuencia.
    fireEvent.dragOver(container.querySelector(".message-drop")!);
    fireEvent.drop(secuencia(), { dataTransfer: makeTransfer(KIND_MIME, "file") });

    expect(lastItems().map((item) => item.kind)).toEqual(["text", "text", "file"]);
  });

  it("ignora lo que se arrastre y no sea un bloque conocido", () => {
    const { onChange } = renderEditor(dosTextos);

    fireEvent.drop(secuencia(), {
      dataTransfer: makeTransfer("application/reactflow", "message")
    });

    expect(onChange).not.toHaveBeenCalled();
  });

  it("construye una secuencia entera solo arrastrando", () => {
    let config: Record<string, unknown> = { items: [] };
    const onChange = vi.fn<(patch: NodePatch) => void>((patch) => {
      config = patch.config as Record<string, unknown>;
    });

    for (const kind of ["text", "image", "audio", "file"]) {
      const { unmount } = render(
        <MessageEditor draft={{ name: "M", content: {}, config }} onChange={onChange} />
      );
      fireEvent.drop(
        screen.queryByRole("list", { name: "Contenidos del mensaje" }) ??
          screen.getByText(/Arrastra un bloque desde la izquierda/),
        { dataTransfer: makeTransfer(KIND_MIME, kind) }
      );
      unmount();
    }

    expect((config.items as Array<{ kind: string }>).map((i) => i.kind)).toEqual([
      "text",
      "image",
      "audio",
      "file"
    ]);
  });
});

describe("reordenar", () => {
  it("mueve un bloque al arrastrarlo sobre otro", () => {
    const { lastItems } = renderEditor(dosTextos);

    const filas = within(secuencia()).getAllByRole("listitem");
    fireEvent.dragOver(filas[0]);
    fireEvent.drop(secuencia(), { dataTransfer: makeTransfer(REORDER_MIME, "b") });

    expect(lastItems().map((item) => item.id)).toEqual(["b", "a"]);
  });

  it("mantiene subir y bajar como alternativa accesible", () => {
    const { lastItems } = renderEditor(dosTextos);

    fireEvent.click(screen.getAllByRole("button", { name: /^Bajar/ })[0]);

    expect(lastItems().map((item) => item.id)).toEqual(["b", "a"]);
  });

  it("no deja subir el primero ni bajar el último", () => {
    renderEditor(dosTextos);

    const subir = screen.getAllByRole("button", { name: /^Subir/ });
    const bajar = screen.getAllByRole("button", { name: /^Bajar/ });

    expect((subir[0] as HTMLButtonElement).disabled).toBe(true);
    expect((bajar[1] as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("editar, eliminar y duplicar", () => {
  it("pinta un bloque por cada elemento, en orden", () => {
    renderEditor(dosTextos);

    const campos = screen.getAllByRole("textbox");
    expect(campos).toHaveLength(2);
    expect((campos[0] as HTMLTextAreaElement).value).toBe("Hola");
    expect((campos[1] as HTMLTextAreaElement).value).toBe("Adiós");
  });

  it("edita el texto sin tocar los demás bloques", () => {
    const { lastItems } = renderEditor(dosTextos);

    fireEvent.change(screen.getByLabelText("Texto del bloque 1"), {
      target: { value: "Buenas" }
    });

    expect(lastItems()).toMatchObject([
      { id: "a", text: "Buenas" },
      { id: "b", text: "Adiós" }
    ]);
  });

  it("elimina un bloque", () => {
    const { lastItems } = renderEditor(dosTextos);

    fireEvent.click(screen.getAllByRole("button", { name: /^Eliminar/ })[0]);

    expect(lastItems().map((item) => item.id)).toEqual(["b"]);
  });

  it("duplica justo detrás del original, con id nuevo", () => {
    const { lastItems } = renderEditor(dosTextos);

    fireEvent.click(screen.getAllByRole("button", { name: /^Duplicar/ })[0]);

    const items = lastItems();
    expect(items).toHaveLength(3);
    expect(items[1]).toMatchObject({ text: "Hola" });
    expect(items[1].id).not.toBe("a");
  });
});

describe("cada tipo de bloque tiene su propia interfaz", () => {
  it("texto usa un editor multilínea con altura y tope", () => {
    const { container } = renderEditor(dosTextos);

    const campo = screen.getByLabelText("Texto del bloque 1") as HTMLTextAreaElement;
    expect(campo.tagName).toBe("TEXTAREA");
    expect(campo.className).toContain("message-item__text");
    // La rueda se queda dentro del campo en vez de hacer zoom en el lienzo.
    expect(campo.className).toContain("nowheel");
    expect(container.querySelector(".message-item__text")).not.toBeNull();
  });

  // -------------------------------------------------------------------------
  // Altura del campo de texto.
  //
  // El mínimo de tres renglones lo fija el CSS, así que se lee el CSS real en
  // vez de afirmarlo: jsdom no maqueta, y una prueba que comprobara píxeles
  // aquí mediría cero y pasaría siempre. Lo que sí se puede garantizar —y es lo
  // que se rompería en una regresión— es que la regla siga declarando un suelo
  // expresado en renglones y un tope que corte el crecimiento.
  // -------------------------------------------------------------------------
  describe("altura del campo de texto", () => {
    // Ruta desde la raíz de `apps/web`, que es donde vitest arranca.
    // `import.meta.url` no sirve aquí: bajo Vite no es un `file://`.
    const css = readFileSync(
      "src/features/automations/builder/tools/message/message-editor.css",
      "utf8"
    );
    const bloqueCss = (selector: string) => {
      const desde = css.indexOf(`${selector} {`);
      return css.slice(desde, css.indexOf("}", desde));
    };
    const regla = bloqueCss(".message-item__text");
    const cuerpo = bloqueCss(".message-item__body");

    it("el campo de texto existe y es un textarea", () => {
      renderEditor({ items: [{ id: "a", kind: "text", text: "" }] });

      const campo = screen.getByLabelText("Texto del bloque 1");
      expect(campo.tagName).toBe("TEXTAREA");
      expect(campo.className).toContain("message-item__text");
    });

    // El ancho intrínseco de un textarea —20 columnas a falta de `cols`— actúa
    // como suelo de `min-width` cuando el elemento es un ítem flex, y ese suelo
    // gana a `width: 100%`. Si vuelve, el campo se sale del bloque en cuanto
    // este es estrecho y el texto deja de repartirse por el ancho visible.
    it("ni el campo ni su cuerpo conservan el ancho mínimo intrínseco", () => {
      // Basta con que UN eslabón de la cadena conserve su mínimo de contenido
      // para que el ancho lo acabe fijando el texto en vez del contenedor.
      expect(regla).toMatch(/min-width:\s*0/);
      expect(cuerpo).toMatch(/min-width:\s*0/);
      expect(bloqueCss(".message-builder__scroll")).toMatch(/min-width:\s*0/);
      expect(bloqueCss(".message-item")).toMatch(/min-width:\s*0/);
      // Tres maneras distintas de crecer a lo ancho, tres cierres.
      expect(regla).toMatch(/max-width:\s*100%/);
      expect(regla).toMatch(/overflow-x:\s*hidden/);
      expect(regla).toMatch(/word-break:\s*break-word/);
      // El relleno y los filos cuentan dentro del ancho declarado; si esto
      // desapareciera, `width: 100%` sumaría 26px y desbordaría el bloque.
      expect(readFileSync("src/shared/styles/base.css", "utf8")).toMatch(
        /box-sizing:\s*border-box/
      );
    });

    it("el alto lo dimensiona el contenido, no solo el efecto de JavaScript", () => {
      // Con `field-sizing` el alto ya es correcto en el primer pintado. Donde
      // no está soportado, `TextItemEditor` hace lo mismo midiendo.
      expect(regla).toMatch(/field-sizing:\s*content/);
    });

    it("el textarea envuelve por declaración explícita, no por omisión", () => {
      renderEditor({ items: [{ id: "a", kind: "text", text: "" }] });

      // `wrap="off"` es la única forma de que un textarea deje de envolver.
      // Escrito, se ve; omitido, alguien lo cambia sin saber qué rompe.
      expect(screen.getByLabelText("Texto del bloque 1").getAttribute("wrap")).toBe("soft");
    });

    it("el suelo del campo son tres renglones, no una altura fija en píxeles", () => {
      // `3 * 1.6em` son tres veces la altura de línea de la propia regla. Si
      // alguien lo vuelve a poner en píxeles, el vínculo con el número de
      // renglones se pierde y esta prueba lo dice.
      const minimo = /min-height:\s*calc\(\s*3\s*\*\s*([\d.]+)em/.exec(regla);
      expect(minimo).not.toBeNull();

      const alturaLinea = /line-height:\s*([\d.]+)/.exec(regla);
      expect(alturaLinea?.[1]).toBe(minimo?.[1]);
    });

    it("el crecimiento tiene tope y desplaza dentro de sí, no estira el bloque", () => {
      // Sin el tope, un mensaje largo estiraría la secuencia y empujaría el
      // marco del nodo expandido, que tiene tamaño fijo por diseño.
      expect(regla).toMatch(/max-height:\s*\d+px/);
      expect(regla).toMatch(/overflow-y:\s*auto/);
    });

    it("un texto largo envuelve y no ensancha el bloque", () => {
      const largo = "palabra ".repeat(300) + "https://un-enlace-larguisimo-sin-espacios.example/x";
      renderEditor({ items: [{ id: "a", kind: "text", text: largo }] });

      const campo = screen.getByLabelText("Texto del bloque 1") as HTMLTextAreaElement;
      expect(campo.value).toBe(largo);
      // Las dos declaraciones que impiden el desbordamiento horizontal: los
      // renglones bajan, y una palabra sin espacios —una URL— se parte en vez
      // de empujar el ancho.
      expect(regla).toMatch(/white-space:\s*pre-wrap/);
      expect(regla).toMatch(/overflow-wrap:\s*anywhere/);
      expect(regla).not.toMatch(/white-space:\s*nowrap/);
      expect(regla).toMatch(/width:\s*100%/);
      expect(regla).not.toMatch(/overflow-x:\s*(auto|scroll)/);
    });

    it("conserva el resize vertical y la ayuda de variables", () => {
      renderEditor({ items: [{ id: "a", kind: "text", text: "" }] });

      expect(regla).toMatch(/resize:\s*vertical/);
      expect(
        (screen.getByLabelText("Texto del bloque 1") as HTMLTextAreaElement).placeholder
      ).toContain("{{context.nombre}}");
    });

    it("el mínimo de tres renglones del texto principal no alcanza a la descripción multimedia", () => {
      renderEditor({ items: [{ id: "x", kind: "image", url: "", caption: "" }] });

      // Los dos son <textarea> — la descripción también envuelve, ver el
      // describe de abajo—, pero son dos campos distintos con su propio suelo
      // y su propio tope: la descripción es compacta y secundaria, y si
      // heredara el mínimo del texto principal (148px) competiría en
      // protagonismo con el área de carga que tiene encima.
      const desc = screen.getByLabelText("Descripción de la imagen");
      expect(desc.tagName).toBe("TEXTAREA");
      expect(desc.className).not.toContain("message-item__text");
      expect(desc.className).toContain("media-caption__input");
    });
  });

  // ---------------------------------------------------------------------------
  // Descripción de imagen/video/audio/archivo.
  //
  // Fue un <input> hasta que una captura real mostró el defecto: un input no
  // tiene mecanismo de wrapping, así que un texto largo se desplazaba en una
  // sola línea sin importar qué dijera el CSS. Ahora es un <textarea>, con su
  // propio suelo de tres renglones y su propio tope — no el mismo tope que el
  // texto principal, porque esta caja es secundaria frente al área de carga.
  // ---------------------------------------------------------------------------
  describe("descripción multimedia: ancho y envoltura", () => {
    const css = readFileSync(
      "src/features/automations/builder/tools/message/message-editor.css",
      "utf8"
    );
    const bloqueCss = (selector: string) => {
      const desde = css.indexOf(`${selector} {`);
      return css.slice(desde, css.indexOf("}", desde));
    };
    const regla = bloqueCss(".media-caption__input");
    const envoltura = bloqueCss(".media-caption");

    it("es un textarea, no un input: un input no puede envolver texto", () => {
      renderEditor({ items: [{ id: "x", kind: "image", url: "", caption: "" }] });

      const campo = screen.getByLabelText("Descripción de la imagen");
      expect(campo.tagName).toBe("TEXTAREA");
    });

    it("ni el campo ni su envoltura conservan el ancho mínimo intrínseco del textarea", () => {
      // Mismo mecanismo que rompía el texto principal: a falta de `cols`, el
      // ancho intrínseco de un textarea actúa como suelo de `min-width` en un
      // flex item y gana a `width: 100%`.
      expect(regla).toMatch(/min-width:\s*0/);
      expect(envoltura).toMatch(/min-width:\s*0/);
      expect(regla).toMatch(/max-width:\s*100%/);
      expect(regla).toMatch(/overflow-x:\s*hidden/);
    });

    it("envuelve por ancho y parte palabras sin espacios, sin desbordar", () => {
      expect(regla).toMatch(/white-space:\s*pre-wrap/);
      expect(regla).toMatch(/overflow-wrap:\s*anywhere/);
      expect(regla).toMatch(/word-break:\s*break-word/);
      expect(regla).not.toMatch(/white-space:\s*nowrap/);
      expect(regla).toMatch(/width:\s*100%/);
    });

    it("el suelo son tres renglones, no una altura fija en píxeles", () => {
      const minimo = /min-height:\s*calc\(\s*3\s*\*\s*([\d.]+)em/.exec(regla);
      expect(minimo).not.toBeNull();

      const alturaLinea = /line-height:\s*([\d.]+)/.exec(regla);
      expect(alturaLinea?.[1]).toBe(minimo?.[1]);
    });

    it("el crecimiento tiene tope propio, más bajo que el del texto principal", () => {
      const tope = /max-height:\s*(\d+)px/.exec(regla);
      expect(tope).not.toBeNull();
      expect(Number(tope?.[1])).toBeLessThan(300);
      expect(regla).toMatch(/overflow-y:\s*auto/);
    });

    it("un texto largo sin espacios queda en el valor del campo sin romper el layout", () => {
      const sinEspacios =
        "jhvjhbhjkbjhkhvjhgcvytfgcxytfgctgfxckiytghdcftugyfvclomuyfvuoyh7jgtfbvloik8u7fgylpoiuy7gftrploi7ugfu7h";
      renderEditor({ items: [{ id: "x", kind: "image", url: "", caption: sinEspacios }] });

      const campo = screen.getByLabelText("Descripción de la imagen") as HTMLTextAreaElement;
      expect(campo.value).toBe(sinEspacios);
      expect(campo.tagName).toBe("TEXTAREA");
    });
  });

  it("texto largo se queda dentro del bloque en vez de romper el layout", () => {
    const largo = "palabra ".repeat(400) + "https://un-enlace-larguisimo-sin-espacios.example/x";
    renderEditor({ items: [{ id: "a", kind: "text", text: largo }] });

    const campo = screen.getByLabelText("Texto del bloque 1") as HTMLTextAreaElement;
    expect(campo.value).toBe(largo);
    // Ni el bloque ni la secuencia ganan un desplazamiento horizontal: el
    // texto baja de renglón y el campo desplaza dentro de sí.
    expect(campo.className).toContain("message-item__text");
  });

  it("imagen tiene selector propio y descripción, no un textarea", () => {
    const { container } = renderEditor({ items: [{ id: "x", kind: "image", url: "", caption: "" }] });

    expect(screen.getByLabelText("Seleccionar imagen del bloque 1")).toBeTruthy();
    expect(screen.getByLabelText("Descripción de la imagen")).toBeTruthy();
    expect(container.querySelector(".message-item__text")).toBeNull();
  });

  // El rótulo nombra el contenido, no la posición. «Descripción del bloque 3»
  // obliga a mirar arriba para saber de qué se habla; con seis bloques en la
  // secuencia esa mirada se repite seis veces.
  it.each([
    ["image", "Descripción de la imagen", "Describe brevemente esta imagen…"],
    ["video", "Descripción del video", "Describe brevemente este video…"],
    ["audio", "Descripción del audio", "Describe brevemente este audio…"],
    ["file", "Descripción del archivo", "Describe brevemente este archivo…"]
  ] as const)("la descripción de %s se rotula por su contenido", (kind, rotulo, ejemplo) => {
    renderEditor({ items: [{ id: "x", kind, url: "", caption: "" }] });

    const campo = screen.getByLabelText(rotulo) as HTMLTextAreaElement;
    expect(campo.placeholder).toBe(ejemplo);
    // Va después del área de carga: describe lo elegido, no algo previo.
    expect(campo.closest(".message-item__body")?.querySelector(".media-caption")).toBeTruthy();
  });

  it("imagen con enlace lo muestra al abrir la pestaña URL", () => {
    const { container } = renderEditor({
      items: [{ id: "x", kind: "image", url: "https://cdn.test/foto.png", caption: "" }]
    });

    // El enlace vive en la configuración, pero la pestaña inicial es Archivo:
    // hay que ir a URL para verlo, que es el flujo especificado.
    fireEvent.click(screen.getByRole("tab", { name: "URL" }));

    const thumb = container.querySelector(".media-url__thumb") as HTMLImageElement;
    expect(thumb?.src).toBe("https://cdn.test/foto.png");
    expect(screen.getByText("foto.png")).toBeTruthy();
  });

  it("video tiene su selector propio", () => {
    const { container } = renderEditor({ items: [{ id: "x", kind: "video", url: "", caption: "" }] });

    expect(screen.getByLabelText("Seleccionar video del bloque 1")).toBeTruthy();
    expect(container.querySelector(".message-item__text")).toBeNull();
  });

  it("audio con enlace muestra su nombre, no la URL entera", () => {
    renderEditor({
      items: [{ id: "x", kind: "audio", url: "https://cdn.test/media/saludo.mp3", caption: "" }]
    });

    fireEvent.click(screen.getByRole("tab", { name: "URL" }));

    expect(screen.getByText("saludo.mp3")).toBeTruthy();
  });

  it("archivo tiene su selector propio, sin limitarse a PDF", () => {
    renderEditor({ items: [{ id: "x", kind: "file", url: "", caption: "" }] });

    expect(screen.getByLabelText("Seleccionar archivo del bloque 1")).toBeTruthy();
    expect(screen.queryByText(/PDF/i)).toBeNull();
  });

  it("borrar la URL deja el bloque sin enlace", () => {
    const { lastItems } = renderEditor({
      items: [{ id: "x", kind: "file", url: "https://cdn.test/doc.pdf", caption: "" }]
    });

    fireEvent.click(screen.getByRole("tab", { name: "URL" }));
    fireEvent.change(screen.getByLabelText("URL del archivo del bloque 1"), {
      target: { value: "" }
    });

    expect(lastItems()[0]).toMatchObject({ kind: "file", url: "" });
  });

  it("intervalo tiene duración y unidad", () => {
    const { container } = renderEditor({
      items: [{ id: "p", kind: "interval", amount: 15, unit: "seconds" }]
    });

    const cantidad = screen.getByLabelText("Duración de la pausa del bloque 1") as HTMLInputElement;
    const unidad = screen.getByLabelText("Unidad de la pausa del bloque 1") as HTMLSelectElement;

    expect(cantidad.value).toBe("15");
    expect(unidad.value).toBe("seconds");
    expect(container.querySelector(".message-item__text")).toBeNull();
  });

  it("guarda la duración y la unidad que se eligen", () => {
    const { lastItems } = renderEditor({
      items: [{ id: "p", kind: "interval", amount: 5, unit: "seconds" }]
    });

    fireEvent.change(screen.getByLabelText("Duración de la pausa del bloque 1"), {
      target: { value: "30" }
    });
    expect(lastItems()[0]).toMatchObject({ amount: 30 });

    fireEvent.change(screen.getByLabelText("Unidad de la pausa del bloque 1"), {
      target: { value: "minutes" }
    });
    expect(lastItems()[0]).toMatchObject({ unit: "minutes" });
  });

  it("no acepta una pausa de cero ni negativa", () => {
    const { lastItems } = renderEditor({
      items: [{ id: "p", kind: "interval", amount: 5, unit: "seconds" }]
    });

    fireEvent.change(screen.getByLabelText("Duración de la pausa del bloque 1"), {
      target: { value: "0" }
    });

    expect(lastItems()[0]).toMatchObject({ amount: 1 });
  });

  it("la interfaz no menciona en ningún sitio el estado del backend", () => {
    renderEditor({
      items: [
        { id: "a", kind: "text", text: "Hola" },
        { id: "b", kind: "image", url: "", caption: "" },
        { id: "c", kind: "interval", amount: 5, unit: "seconds" }
      ]
    });

    expect(
      screen.queryByText(/próximamente|pendiente|no ejecutable|OutboundMessage|runtime|handler/i)
    ).toBeNull();
  });
});

describe("una sola fuente de verdad", () => {
  it("retira el content.text heredado al escribir la secuencia", () => {
    const { lastPatch } = renderEditor({}, { text: "viejo" });

    fireEvent.click(screen.getByRole("button", { name: "Añadir Texto" }));

    // La misma información no puede quedar en `content` y en `config`.
    expect(lastPatch()?.content).toEqual({});
    expect(lastPatch()?.config?.items).toHaveLength(2);
  });

  it("conserva las demás claves del contenido al retirar la heredada", () => {
    const { lastPatch } = renderEditor({}, { text: "viejo", nota: "ajena" });

    fireEvent.click(screen.getByRole("button", { name: "Añadir Texto" }));

    expect(lastPatch()?.content).toEqual({ nota: "ajena" });
  });

  it("muestra un nodo antiguo como un único bloque de texto", () => {
    renderEditor({}, { text: "Mensaje de siempre" });

    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("Mensaje de siempre");
  });
});

describe("contador de bloques", () => {
  it("dice vacío cuando no hay ninguno", () => {
    const { container } = renderEditor();

    expect(container.querySelector(".message-builder__count")?.textContent).toBe("vacío");
  });

  it("cuenta uno en singular", () => {
    const { container } = renderEditor({ items: [{ id: "a", kind: "text", text: "" }] });

    expect(container.querySelector(".message-builder__count")?.textContent).toBe("1 bloque");
  });

  it("refleja el número real de bloques, no un valor fijo", () => {
    for (const total of [2, 3, 7]) {
      const { container, unmount } = renderEditor({
        items: Array.from({ length: total }, (_, i) => ({ id: `i${i}`, kind: "text", text: "" }))
      });

      expect(container.querySelector(".message-builder__count")?.textContent).toBe(
        `${total} bloques`
      );
      unmount();
    }
  });
});

describe("el constructor no crece sin límite", () => {
  it("mantiene los bloques dentro de un área que desplaza", () => {
    const muchos = {
      items: Array.from({ length: 12 }, (_, i) => ({
        id: `i${i}`,
        kind: "text",
        text: `bloque ${i}`
      }))
    };

    const { container } = renderEditor(muchos);

    expect(within(secuencia()).getAllByRole("listitem")).toHaveLength(12);
    // El área desplazable existe y envuelve la secuencia: es lo que impide que
    // doce bloques estiren el nodo y descuadren el lienzo.
    const scroll = container.querySelector(".message-builder__scroll");
    expect(scroll).not.toBeNull();
    expect(scroll?.contains(secuencia())).toBe(true);
  });

  it("la rueda del ratón se queda dentro en vez de hacer zoom en el lienzo", () => {
    const { container } = renderEditor(dosTextos);

    expect(container.querySelector(".message-builder__scroll")?.className).toContain("nowheel");
  });
});

describe("el gesto no se le escapa al lienzo", () => {
  it("todo control interactivo neutraliza el arrastre del nodo", () => {
    const { container } = renderEditor(dosTextos);

    const interactivos = container.querySelectorAll(
      "button, textarea, input, .message-item__grip"
    );

    expect(interactivos.length).toBeGreaterThan(0);
    for (const elemento of interactivos) {
      expect(elemento.className).toContain("nodrag");
    }
  });
});
