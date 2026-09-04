import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { useState } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MessageEditor } from "@features/automations/builder/tools/message/MessageEditor";
import type { NodePatch } from "@features/automations/builder/services/applyNodePatch";
import { MESSAGE_ITEM_KINDS } from "@features/automations/builder/tools/message/messageItems";

// ---------------------------------------------------------------------------
// Acabado visual y de interacción del constructor.
//
// Los tests anteriores prueban QUÉ hace el editor. Estos prueban CÓMO se
// comporta: que el bloque recién nacido se revele solo, que escribir no
// desplace nada, que cada tipo tenga señal propia y que el estado de arrastre
// aparezca y se apague.
//
// El editor se monta dentro de un contenedor que devuelve la configuración,
// igual que hace el nodo real. Sin ese bucle, el bloque nuevo nunca llegaría a
// existir en el DOM y el autoscroll no podría observarse — que es exactamente
// el defecto que este arnés destapó.
// ---------------------------------------------------------------------------

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

/** Monta el editor cerrando el bucle configuración → editor → configuración. */
function ConectadoAlNodo({ inicial }: { inicial: Record<string, unknown> }) {
  const [config, setConfig] = useState(inicial);
  const [content, setContent] = useState<Record<string, unknown>>({});

  return (
    <MessageEditor
      draft={{ name: "Mensaje", content, config }}
      onChange={(patch: NodePatch) => {
        if (patch.config) setConfig(patch.config);
        if (patch.content) setContent(patch.content);
      }}
    />
  );
}

function renderConectado(inicial: Record<string, unknown> = { items: [] }) {
  return render(<ConectadoAlNodo inicial={inicial} />);
}

const textos = (total: number) => ({
  items: Array.from({ length: total }, (_, i) => ({ id: `i${i}`, kind: "text", text: `b${i}` }))
});

const secuencia = () => screen.getByRole("list", { name: "Contenidos del mensaje" });

let scrollTo: ReturnType<typeof vi.fn>;
let scrollIntoView: ReturnType<typeof vi.fn>;

beforeEach(() => {
  // jsdom no implementa el desplazamiento; se observan las llamadas.
  //
  // Se vigilan LAS DOS vías a propósito. `scrollIntoView` sube por el árbol y
  // desplaza cualquier ancestro desplazable: con el marco del nodo teniendo su
  // propio `overflow`, eso sacaba la biblioteca y la zona de continuación fuera
  // de la ventana. Los tests exigen ahora que el editor desplace su PROPIO
  // contenedor y que no recurra nunca a `scrollIntoView`.
  scrollTo = vi.fn();
  scrollIntoView = vi.fn();
  Element.prototype.scrollTo = scrollTo as unknown as typeof Element.prototype.scrollTo;
  Element.prototype.scrollIntoView =
    scrollIntoView as unknown as typeof Element.prototype.scrollIntoView;
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** El contenedor que realmente recibió el desplazamiento. */
const desplazado = () => scrollTo.mock.instances[0] as HTMLElement | undefined;

describe("autoscroll al bloque nuevo", () => {
  it("desplaza el contenedor del constructor, no el marco del nodo", () => {
    const { container } = renderConectado(textos(6));

    fireEvent.click(screen.getByRole("button", { name: "Añadir Intervalo" }));

    // El defecto que este test existe para impedir: desplazar un ancestro y
    // sacar la biblioteca y la zona de continuación fuera de la ventana.
    expect(desplazado()).toBe(container.querySelector(".message-builder__scroll"));
  });

  it("no recurre a scrollIntoView, que arrastraría a los ancestros", () => {
    renderConectado(textos(6));

    fireEvent.click(screen.getByRole("button", { name: "Añadir Texto" }));

    expect(scrollIntoView).not.toHaveBeenCalled();
    expect(scrollTo).toHaveBeenCalled();
  });

  it("revela el bloque que llega arrastrado", () => {
    renderConectado(textos(6));

    fireEvent.drop(secuencia(), { dataTransfer: makeTransfer(KIND_MIME, "image") });

    expect(scrollTo).toHaveBeenCalled();
  });

  it("va al fondo cuando el bloque nuevo es el último, para que se vea con la zona", () => {
    renderConectado(textos(6));

    fireEvent.click(screen.getByRole("button", { name: "Añadir Audio" }));

    // Al final se va al fondo: es lo único que deja visibles A LA VEZ el bloque
    // recién creado y la zona de continuación que hay debajo.
    const [opciones] = scrollTo.mock.calls[0] as [{ top: number; behavior: string }];
    expect(opciones.top).toBe(0); // scrollHeight es 0 en jsdom
    expect(opciones.behavior).toBe("smooth");
  });

  it("sigue funcionando con muchos bloques", () => {
    renderConectado(textos(24));

    fireEvent.click(screen.getByRole("button", { name: "Añadir Archivo" }));

    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(within(secuencia()).getAllByRole("listitem")).toHaveLength(25);
  });

  it("también al duplicar el último, porque la copia pasa a ser el final", () => {
    renderConectado(textos(3));

    const duplicar = screen.getAllByRole("button", { name: /^Duplicar/ });
    fireEvent.click(duplicar[duplicar.length - 1]);

    expect(scrollTo).toHaveBeenCalled();
  });

  it("NO desplaza al duplicar un bloque que ya se ve: sería un salto gratuito", () => {
    renderConectado(textos(3));

    fireEvent.click(screen.getAllByRole("button", { name: /^Duplicar/ })[0]);

    // La copia cae en medio de la secuencia. Solo se desplaza si queda fuera
    // del área visible, y aquí no lo está.
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it("NO desplaza al escribir: es lo que haría el editor inusable", () => {
    renderConectado(textos(8));

    fireEvent.change(screen.getByLabelText("Texto del bloque 1"), {
      target: { value: "escribiendo despacio" }
    });

    expect(scrollTo).not.toHaveBeenCalled();
  });

  it("NO desplaza al reordenar con los botones", () => {
    renderConectado(textos(8));

    fireEvent.click(screen.getAllByRole("button", { name: /^Bajar/ })[0]);

    expect(scrollTo).not.toHaveBeenCalled();
  });

  it("NO desplaza al reordenar arrastrando", () => {
    renderConectado(textos(8));

    const filas = within(secuencia()).getAllByRole("listitem");
    fireEvent.dragOver(filas[5]);
    fireEvent.drop(secuencia(), { dataTransfer: makeTransfer(REORDER_MIME, "i0") });

    expect(scrollTo).not.toHaveBeenCalled();
  });

  it("NO desplaza al eliminar", () => {
    renderConectado(textos(8));

    fireEvent.click(screen.getAllByRole("button", { name: /^Eliminar/ })[0]);

    expect(scrollTo).not.toHaveBeenCalled();
  });

  it("NO desplaza al abrir el editor con bloques ya guardados", () => {
    renderConectado(textos(12));

    expect(scrollTo).not.toHaveBeenCalled();
  });
});

describe("identidad visual por tipo", () => {
  it("cada bloque de la biblioteca lleva la señal de su tipo", () => {
    const { container } = renderConectado();

    for (const kind of MESSAGE_ITEM_KINDS) {
      expect(container.querySelector(`.message-library__item--${kind}`)).not.toBeNull();
    }
  });

  it("cada tarjeta del constructor lleva la señal de su tipo", () => {
    const { container } = renderConectado({
      items: MESSAGE_ITEM_KINDS.map((kind, i) =>
        kind === "text"
          ? { id: `k${i}`, kind, text: "" }
          : kind === "interval"
            ? { id: `k${i}`, kind, amount: 5, unit: "seconds" }
            : { id: `k${i}`, kind, url: "", caption: "" }
      )
    });

    for (const kind of MESSAGE_ITEM_KINDS) {
      expect(container.querySelector(`.message-item--${kind}`)).not.toBeNull();
    }
  });

  it("los seis tipos son distinguibles entre sí, no seis veces lo mismo", () => {
    const { container } = renderConectado();

    const clases = [...container.querySelectorAll(".message-library__item")].map(
      (el) => [...el.classList].find((c) => c.startsWith("message-library__item--")) ?? ""
    );

    expect(new Set(clases).size).toBe(6);
  });
});

describe("estado de arrastre", () => {
  it("marca en la biblioteca el bloque que se está llevando", () => {
    const { container } = renderConectado();

    const boton = screen.getByRole("button", { name: "Añadir Imagen" });
    fireEvent.dragStart(boton, { dataTransfer: makeTransfer() });

    expect(container.querySelector(".message-library__item--dragging")).not.toBeNull();
  });

  it("apaga esa marca al terminar el gesto", () => {
    const { container } = renderConectado();

    const boton = screen.getByRole("button", { name: "Añadir Imagen" });
    fireEvent.dragStart(boton, { dataTransfer: makeTransfer() });
    fireEvent.dragEnd(boton);

    expect(container.querySelector(".message-library__item--dragging")).toBeNull();
  });

  it("muestra dónde caerá el bloque al pasar por una posición", () => {
    const { container } = renderConectado(textos(3));

    fireEvent.dragOver(within(secuencia()).getAllByRole("listitem")[1]);

    expect(container.querySelector(".message-item--drop-before")).not.toBeNull();
  });

  it("marca la posición en el bloque que la recibe, y solo en ese", () => {
    const { container } = renderConectado(textos(4));

    const filas = within(secuencia()).getAllByRole("listitem");
    fireEvent.dragOver(filas[2]);

    const marcados = container.querySelectorAll(".message-item--drop-before");
    expect(marcados).toHaveLength(1);
    expect(marcados[0]).toBe(filas[2]);
  });

  it("mueve la marca al pasar de un bloque a otro, sin dejar rastro", () => {
    const { container } = renderConectado(textos(4));

    const filas = within(secuencia()).getAllByRole("listitem");
    fireEvent.dragOver(filas[1]);
    fireEvent.dragOver(filas[3]);

    expect(container.querySelectorAll(".message-item--drop-before")).toHaveLength(1);
    expect(container.querySelector(".message-item--drop-before")).toBe(filas[3]);
  });

  it("reconoce el área entera como destino mientras llega un bloque", () => {
    const { container } = renderConectado(textos(3));

    fireEvent.dragOver(within(secuencia()).getAllByRole("listitem")[0]);

    expect(container.querySelector(".message-builder--receiving")).not.toBeNull();
  });

  it("retira el estado de arrastre al soltar", () => {
    const { container } = renderConectado(textos(3));

    fireEvent.dragOver(within(secuencia()).getAllByRole("listitem")[1]);
    fireEvent.drop(secuencia(), { dataTransfer: makeTransfer(KIND_MIME, "audio") });

    expect(container.querySelector(".message-item--drop-before")).toBeNull();
    expect(container.querySelector(".message-builder--receiving")).toBeNull();
  });
});

describe("zona de continuación", () => {
  const zonas = (c: HTMLElement) => [...c.querySelectorAll(".message-drop")];
  const zona = (c: HTMLElement) => c.querySelector(".message-drop") as HTMLElement;

  it("hay exactamente UNA, con cualquier número de bloques", () => {
    for (const total of [1, 4, 12]) {
      const { container, unmount } = renderConectado(textos(total));

      expect(zonas(container)).toHaveLength(1);
      unmount();
    }
  });

  it("no hay ningún control entre bloques", () => {
    const { container } = renderConectado(textos(5));

    // Lo que había antes: un punto de inserción por hueco. Se retiró porque
    // competía con el contenido, que es lo que el usuario viene a leer.
    expect(container.querySelectorAll(".message-insert")).toHaveLength(0);
    expect(container.querySelectorAll(".message-builder__tail")).toHaveLength(0);
  });

  it("va después del último bloque, no antes ni en medio", () => {
    const { container } = renderConectado(textos(3));

    const hijos = [...secuencia().children];
    expect(hijos[hijos.length - 1]).toBe(zona(container));
    expect(hijos.filter((h) => h.classList.contains("message-item"))).toHaveLength(3);
  });

  it("no se cuenta como bloque: es una superficie, no contenido", () => {
    const { container } = renderConectado(textos(4));

    expect(within(secuencia()).getAllByRole("listitem")).toHaveLength(4);
    expect(zonas(container)).toHaveLength(1);
  });

  it("no es un botón: no pide que la pulses", () => {
    const { container } = renderConectado(textos(2));

    expect(within(zona(container)).queryByRole("button")).toBeNull();
    // Y no lleva un signo de sumar, que es lo que la convertía en botón.
    expect(zona(container).textContent).not.toContain("+");
  });

  it("en reposo invita a arrastrar, sin parecer un control", () => {
    const { container } = renderConectado(textos(2));

    expect(within(zona(container)).getByText("Arrastra aquí")).toBeTruthy();
    expect(within(zona(container)).getByText("para seguir construyendo")).toBeTruthy();
    expect(zona(container).className).not.toContain("message-drop--receiving");
  });

  it("cobra vida al recibir un bloque arrastrado", () => {
    const { container } = renderConectado(textos(3));

    fireEvent.dragOver(zona(container));

    expect(zona(container).className).toContain("message-drop--receiving");
    expect(within(zona(container)).getByText("Suelta aquí")).toBeTruthy();
    expect(within(zona(container)).getByText("se añadirá al final")).toBeTruthy();
  });

  it("añade el bloque al final al soltarlo sobre ella", () => {
    const { container } = renderConectado(textos(3));

    fireEvent.dragOver(zona(container));
    fireEvent.drop(secuencia(), { dataTransfer: makeTransfer(KIND_MIME, "video") });

    const filas = within(secuencia()).getAllByRole("listitem");
    expect(filas).toHaveLength(4);
    expect(filas[3].className).toContain("message-item--video");
  });

  it("el bloque nuevo queda ANTES de la zona, que sigue siendo la última", () => {
    const { container } = renderConectado(textos(2));

    fireEvent.dragOver(zona(container));
    fireEvent.drop(secuencia(), { dataTransfer: makeTransfer(KIND_MIME, "audio") });

    const hijos = [...secuencia().children];
    expect(hijos[hijos.length - 1]).toBe(zona(container));
    expect(hijos[hijos.length - 2].className).toContain("message-item--audio");
  });

  it("vuelve al reposo tras soltar", () => {
    const { container } = renderConectado(textos(3));

    fireEvent.dragOver(zona(container));
    fireEvent.drop(secuencia(), { dataTransfer: makeTransfer(KIND_MIME, "file") });

    expect(zona(container).className).not.toContain("message-drop--receiving");
    expect(within(zona(container)).getByText("Arrastra aquí")).toBeTruthy();
  });

  it("soltar sobre ella revela el bloque nuevo, y con él la propia zona", () => {
    const { container } = renderConectado(textos(20));

    fireEvent.dragOver(zona(container));
    fireEvent.drop(secuencia(), { dataTransfer: makeTransfer(KIND_MIME, "image") });

    // Se desplaza el área del constructor hasta el fondo: el bloque recién
    // creado y la zona de continuación quedan visibles a la vez.
    expect(desplazado()).toBe(container.querySelector(".message-builder__scroll"));
  });

  it("no usa lenguaje técnico: habla de construir, no de «drop»", () => {
    const { container } = renderConectado(textos(2));

    expect(zona(container).textContent).not.toMatch(/drop|target|insert|zone/i);
  });

  it("sigue existiendo cuando la secuencia se queda en un solo bloque", () => {
    const { container } = renderConectado(textos(2));

    fireEvent.click(screen.getAllByRole("button", { name: /^Eliminar/ })[0]);

    expect(zonas(container)).toHaveLength(1);
    expect(within(secuencia()).getAllByRole("listitem")).toHaveLength(1);
  });
});

describe("ayuda de la biblioteca", () => {
  it("explica cómo se usa, al pie de la columna", () => {
    const { container } = renderConectado(textos(3));

    const nota = container.querySelector(".message-library__note");
    expect(nota?.textContent).toMatch(/Arrastra un bloque al contenido/);
    // Dentro de la biblioteca, no del constructor: es lo que cierra la columna.
    expect(container.querySelector(".message-library")?.contains(nota!)).toBe(true);
  });

  it("es el último elemento de la columna", () => {
    const { container } = renderConectado();

    const columna = container.querySelector(".message-library")!;
    expect(columna.lastElementChild).toBe(columna.querySelector(".message-library__note"));
  });

  it("no es un control: no compite con los seis bloques", () => {
    const { container } = renderConectado();

    const nota = container.querySelector(".message-library__note")!;
    expect(nota.tagName).toBe("P");
    expect(within(nota as HTMLElement).queryByRole("button")).toBeNull();
  });
});

describe("estado vacío", () => {
  it("invita a construir en vez de dejar un hueco", () => {
    renderConectado();

    expect(screen.getByText("Construye tu mensaje")).toBeTruthy();
    expect(screen.getByText(/Arrastra un bloque desde la izquierda/)).toBeTruthy();
  });

  it("lleva el icono de la propia herramienta", () => {
    const { container } = renderConectado();

    expect(container.querySelector(".message-empty__icon svg")).not.toBeNull();
  });

  it("desaparece en cuanto llega el primer bloque", () => {
    renderConectado();

    fireEvent.click(screen.getByRole("button", { name: "Añadir Texto" }));

    expect(screen.queryByText("Construye tu mensaje")).toBeNull();
    expect(secuencia()).toBeTruthy();
  });

  it("acepta que se suelte el primer bloque sobre él", () => {
    const { container } = renderConectado();

    const vacio = container.querySelector(".message-empty")!;
    fireEvent.dragOver(vacio);

    expect(container.querySelector(".message-empty--receiving")).not.toBeNull();
  });
});

describe("el contador sigue al modelo en tiempo real", () => {
  const contador = (c: HTMLElement) => c.querySelector(".message-builder__count")?.textContent;

  it("sube al añadir", () => {
    const { container } = renderConectado(textos(2));

    fireEvent.click(screen.getByRole("button", { name: "Añadir Texto" }));

    expect(contador(container)).toBe("3 bloques");
  });

  it("baja al eliminar", () => {
    const { container } = renderConectado(textos(3));

    fireEvent.click(screen.getAllByRole("button", { name: /^Eliminar/ })[0]);

    expect(contador(container)).toBe("2 bloques");
  });

  it("vuelve a vacío al quitar el último", () => {
    const { container } = renderConectado(textos(1));

    fireEvent.click(screen.getByRole("button", { name: /^Eliminar/ }));

    expect(contador(container)).toBe("vacío");
  });
});

describe("la configuración sobrevive al bucle completo", () => {
  it("conserva todos los bloques tras varias operaciones seguidas", () => {
    renderConectado();

    fireEvent.click(screen.getByRole("button", { name: "Añadir Texto" }));
    fireEvent.drop(secuencia(), { dataTransfer: makeTransfer(KIND_MIME, "image") });
    fireEvent.click(screen.getByRole("button", { name: "Añadir Intervalo" }));

    const filas = within(secuencia()).getAllByRole("listitem");
    expect(filas).toHaveLength(3);
    expect(filas[0].className).toContain("message-item--text");
    expect(filas[1].className).toContain("message-item--image");
    expect(filas[2].className).toContain("message-item--interval");
  });

  it("no filtra vocabulario interno en ningún estado", () => {
    renderConectado({
      items: [
        { id: "a", kind: "text", text: "Hola" },
        { id: "b", kind: "image", url: "", caption: "" },
        { id: "c", kind: "video", url: "https://cdn.test/v.mp4", caption: "" },
        { id: "d", kind: "audio", url: "", caption: "" },
        { id: "e", kind: "file", url: "", caption: "" },
        { id: "f", kind: "interval", amount: 5, unit: "seconds" }
      ]
    });

    expect(
      screen.queryByText(
        /próximamente|pendiente|no ejecutable|OutboundMessage|runtime|handler|infraestructura/i
      )
    ).toBeNull();
  });
});
