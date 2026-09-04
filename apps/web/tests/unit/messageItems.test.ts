import { describe, expect, it } from "vitest";
import {
  createMessageItem,
  insertItem,
  isMediaKind,
  appendItem,
  duplicateItem,
  isExecutableKind,
  moveItem,
  removeItem,
  updateItem
} from "@features/automations/builder/tools/message/messageItems";
import { readMessageItems } from "@features/automations/builder/tools/message/readMessageConfig";
import { summarizeMessage } from "@features/automations/builder/tools/message/summarizeMessage";
import type { MessageItem } from "@features/automations/builder/tools/message/types";

// ---------------------------------------------------------------------------
// La secuencia de contenidos de un Mensaje.
//
// Es el modelo que sustituye a `content.text`. Todo lo de aquí es puro, así que
// se prueba sin montar nada: lo que importa es que las operaciones conserven el
// orden, no compartan estado y no pierdan identidad de contenidos.
// ---------------------------------------------------------------------------

const items: MessageItem[] = [
  { id: "a", kind: "text", text: "Hola" },
  { id: "b", kind: "image", url: "", caption: "captura" },
  { id: "c", kind: "text", text: "Adiós" }
];

describe("operaciones sobre la secuencia", () => {
  it("añade al final", () => {
    const next = appendItem(items, "text");

    expect(next).toHaveLength(4);
    expect(next[3].kind).toBe("text");
  });

  it("da identidad propia a cada contenido nuevo", () => {
    const next = appendItem(appendItem(items, "text"), "text");
    const ids = next.map((item) => item.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it("edita un contenido sin tocar los demás", () => {
    const next = updateItem(items, "a", { text: "Buenas" });

    expect(next[0]).toMatchObject({ id: "a", text: "Buenas" });
    expect(next[1]).toEqual(items[1]);
    expect(next[2]).toEqual(items[2]);
  });

  it("elimina el contenido pedido y conserva el orden del resto", () => {
    expect(removeItem(items, "b").map((item) => item.id)).toEqual(["a", "c"]);
  });

  it("duplica justo detrás del original, no al final", () => {
    const next = duplicateItem(items, "a");

    expect(next.map((item) => item.kind)).toEqual(["text", "text", "image", "text"]);
  });

  it("da un id nuevo a la copia", () => {
    const next = duplicateItem(items, "a");

    expect(next[1].id).not.toBe("a");
    expect(next[1]).toMatchObject({ kind: "text", text: "Hola" });
  });

  it("reordena moviendo un contenido a otra posición", () => {
    expect(moveItem(items, "c", 0).map((item) => item.id)).toEqual(["c", "a", "b"]);
  });

  it("acota el destino en vez de rechazarlo", () => {
    expect(moveItem(items, "a", 99).map((item) => item.id)).toEqual(["b", "c", "a"]);
    expect(moveItem(items, "c", -5).map((item) => item.id)).toEqual(["c", "a", "b"]);
  });

  it("nunca muta la lista recibida", () => {
    appendItem(items, "text");
    updateItem(items, "a", { text: "otro" });
    removeItem(items, "a");
    duplicateItem(items, "a");
    moveItem(items, "a", 2);

    expect(items.map((item) => item.id)).toEqual(["a", "b", "c"]);
  });

  it("solo el texto es entregable hoy", () => {
    expect(isExecutableKind("text")).toBe(true);
    for (const kind of ["image", "video", "audio", "file", "interval"] as const) {
      expect(isExecutableKind(kind)).toBe(false);
    }
  });

  it("distingue los bloques que referencian un archivo", () => {
    for (const kind of ["image", "video", "audio", "file"] as const) {
      expect(isMediaKind(kind)).toBe(true);
    }
    expect(isMediaKind("text")).toBe(false);
    expect(isMediaKind("interval")).toBe(false);
  });

  it("una pausa nace con duración usable y unidad, no en cero", () => {
    const pausa = createMessageItem("interval");

    expect(pausa).toMatchObject({ kind: "interval", unit: "seconds" });
    expect(pausa.kind === "interval" && pausa.amount).toBeGreaterThan(0);
  });

  it("un medio nace sin archivo ni descripción", () => {
    expect(createMessageItem("video")).toMatchObject({ kind: "video", url: "", caption: "" });
  });

  it("inserta en la posición pedida, acotando el destino", () => {
    expect(insertItem(items, "audio", 1).map((i) => i.kind)).toEqual([
      "text",
      "audio",
      "image",
      "text"
    ]);
    expect(insertItem(items, "audio", 99).map((i) => i.kind)).toEqual([
      "text",
      "image",
      "text",
      "audio"
    ]);
  });

  it("repara una pausa persistida con datos imposibles", () => {
    const leidos = readMessageItems(
      { items: [{ id: "p", kind: "interval", amount: "diez", unit: "eones" }] },
      {}
    );

    expect(leidos[0]).toMatchObject({ kind: "interval", amount: 5, unit: "seconds" });
  });
});

describe("lectura desde un nodo", () => {
  it("lee la secuencia de config.items", () => {
    const leidos = readMessageItems({ items }, {});

    expect(leidos.map((item) => item.id)).toEqual(["a", "b", "c"]);
  });

  it("lee un nodo antiguo que solo tiene content.text", () => {
    expect(readMessageItems({}, { text: "Mensaje de siempre" })).toEqual([
      { id: "mi-legacy-0", kind: "text", text: "Mensaje de siempre" }
    ]);
  });

  it("devuelve vacío cuando no hay nada legible", () => {
    expect(readMessageItems({}, {})).toEqual([]);
  });

  it("descarta entradas ilegibles sin perder las buenas", () => {
    const leidos = readMessageItems({ items: [null, 7, { kind: "text", text: "vale" }] }, {});

    expect(leidos).toHaveLength(1);
    expect(leidos[0]).toMatchObject({ kind: "text", text: "vale" });
  });

  it("recupera un contenido sin id en vez de tirarlo", () => {
    const leidos = readMessageItems({ items: [{ kind: "text", text: "sin id" }] }, {});

    expect(leidos[0].id).toBe("mi-legacy-0");
  });

  it("no se cae si items no es una lista", () => {
    expect(() => readMessageItems({ items: "no soy una lista" }, {})).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Resumen del nodo cerrado.
//
// Formato fijo: «<Tipo> · <N> bloque(s)», siempre — también con un solo
// bloque, y el tipo lo pone el PRIMERO de la secuencia. La tarjeta cerrada es
// un resumen, no una miniatura: nunca enseña el contenido real de un bloque,
// solo su tipo y cuántos hay.
// ---------------------------------------------------------------------------
describe("resumen derivado de la configuración", () => {
  it("sin bloques: lo dice en vez de quedarse en blanco", () => {
    expect(summarizeMessage({}, {})).toBe("Mensaje vacío");
  });

  it("un bloque de imagen: singular, no 'bloques'", () => {
    const items = [{ id: "x", kind: "image", url: "", caption: "" }];
    expect(summarizeMessage({}, { items })).toBe("Imagen · 1 bloque");
  });

  it("cinco bloques con el primero imagen", () => {
    const items = [
      { id: "1", kind: "image", url: "", caption: "" },
      { id: "2", kind: "text", text: "a" },
      { id: "3", kind: "text", text: "b" },
      { id: "4", kind: "video", url: "", caption: "" },
      { id: "5", kind: "audio", url: "", caption: "" }
    ];
    expect(summarizeMessage({}, { items })).toBe("Imagen · 5 bloques");
  });

  it("primer bloque de texto: nombra el tipo, no enseña el contenido", () => {
    expect(summarizeMessage({}, { items })).toBe("Texto · 3 bloques");
  });

  it("primer bloque de video", () => {
    const items = [{ id: "v", kind: "video", url: "", caption: "" }];
    expect(summarizeMessage({}, { items })).toBe("Video · 1 bloque");
  });

  it("primer bloque de audio", () => {
    const items = [{ id: "a", kind: "audio", url: "", caption: "" }];
    expect(summarizeMessage({}, { items })).toBe("Audio · 1 bloque");
  });

  it("contenido mixto: el tipo lo pone el primero, sin clasificar la mezcla", () => {
    const mixto = [
      { id: "1", kind: "audio", url: "", caption: "" },
      { id: "2", kind: "image", url: "", caption: "" },
      { id: "3", kind: "text", text: "x" }
    ];
    expect(summarizeMessage({}, { items: mixto })).toBe("Audio · 3 bloques");
  });

  it("configuración inválida: no rompe el renderer, la trata como vacía", () => {
    expect(summarizeMessage({}, { items: "no es una lista" })).toBe("Mensaje vacío");
    expect(summarizeMessage({}, { items: null })).toBe("Mensaje vacío");
    expect(() => summarizeMessage({}, {})).not.toThrow();
  });

  it("no filtra vocabulario de desarrollo al lienzo", () => {
    expect(summarizeMessage({}, { items })).not.toMatch(
      /pendiente|próximamente|sin enviar|runtime/i
    );
  });

  it("un nodo antiguo con content.text se resume igual que cualquier otro: por tipo y cantidad, no por su contenido literal", () => {
    expect(summarizeMessage({ text: "Mensaje de siempre" }, {})).toBe("Texto · 1 bloque");
  });
});
