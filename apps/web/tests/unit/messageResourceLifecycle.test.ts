import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  adjuntarArchivo,
  archivoDeSesion,
  enlaceDeSesion,
  soltarArchivo
} from "@features/automations/builder/tools/message/mediaSourceSession";
import { releaseMessageResources } from "@features/automations/builder/tools/message/releaseMessageResources";
import { duplicateItem } from "@features/automations/builder/tools/message/messageItems";
import { duplicateMessageConfig } from "@features/automations/builder/tools/message/duplicateMessageConfig";
import { validateMessageContent } from "@features/automations/builder/tools/message/validateMessageContent";
import { releaseNodeResources } from "@features/automations/builder/services/releaseNodeResources";
import { getTool } from "@features/automations/builder/tools/registry";
import { createNodeDraft } from "@features/automations/builder/services/createNodeDraft";
import type { MessageItem } from "@features/automations/builder/tools/message/types";

// ---------------------------------------------------------------------------
// EL CICLO DE VIDA DE UN ARCHIVO ELEGIDO DEL DISPOSITIVO.
//
// Los bytes no caben en la configuración, así que viven aparte indexados por la
// identidad del bloque. Eso abre dos caminos por los que el estado puede
// mentir, y estas pruebas los cierran:
//
//   BORRAR EL NODO   se llevaba la configuración y dejaba los bytes retenidos,
//                    sin nadie que pudiera volver a llegar a ellos.
//   DUPLICAR         estrenaba identidad y heredaba el NOMBRE del archivo: un
//                    bloque que decía tener un archivo que no existía.
// ---------------------------------------------------------------------------

let revocados: string[];

const medio = (id: string, kind = "video", extra: Record<string, unknown> = {}) => ({
  id,
  kind,
  url: "",
  fileName: "",
  caption: "",
  sendOnce: false,
  ...extra
});

const archivo = (nombre: string) => new File(["bytes"], nombre, { type: "video/mp4" });

beforeEach(() => {
  revocados = [];
  const conUrl = URL as unknown as Record<string, unknown>;
  conUrl.createObjectURL ??= () => "";
  conUrl.revokeObjectURL ??= () => {};
  let n = 0;
  vi.spyOn(URL, "createObjectURL").mockImplementation((f) => `blob:falso/${(f as File).name}/${++n}`);
  vi.spyOn(URL, "revokeObjectURL").mockImplementation((u) => void revocados.push(u));
});

afterEach(() => {
  for (const id of ["a", "b", "c", "copia"]) soltarArchivo(id);
  vi.restoreAllMocks();
});

describe("borrar el nodo suelta los archivos de sus bloques", () => {
  const config = (items: ReadonlyArray<Record<string, unknown>>) => ({ items });

  it("cada bloque con archivo queda liberado y su enlace revocado", () => {
    const enlaceA = adjuntarArchivo("a", archivo("uno.mp4"));
    const enlaceB = adjuntarArchivo("b", archivo("dos.mp4"));

    releaseMessageResources(config([medio("a"), medio("b")]));

    expect(revocados).toEqual(expect.arrayContaining([enlaceA, enlaceB]));
    expect(enlaceDeSesion("a")).toBeNull();
    expect(enlaceDeSesion("b")).toBeNull();
    expect(archivoDeSesion("a")).toBeNull();
  });

  it("los bloques sin archivo no molestan, y una config rara no rompe el borrado", () => {
    // Un texto, una pausa y un medio con enlace no tienen nada que soltar.
    expect(() =>
      releaseMessageResources(
        config([
          { id: "t", kind: "text", text: "Hola" },
          { id: "p", kind: "interval", amount: 5, unit: "seconds" },
          medio("c", "image", { url: "https://cdn.test/f.png" })
        ])
      )
    ).not.toThrow();
    expect(() => releaseMessageResources({})).not.toThrow();
  });

  it("Mensaje declara la costura; las demás herramientas no la necesitan", () => {
    expect(getTool("message")?.releaseResources).toBeTypeOf("function");

    for (const type of ["tags", "condition", "menu", "notification", "end"]) {
      expect(getTool(type)?.releaseResources, `'${type}' reserva algo`).toBeUndefined();
    }
  });

  it("el lienzo libera sin saber de qué herramienta se trata", () => {
    // `releaseNodeResources` recibe un nodo y pregunta a su herramienta. No hay
    // un solo `if` por tipo en el camino de borrado.
    const base = createNodeDraft("message", 0);
    const enlace = adjuntarArchivo("a", archivo("uno.mp4"));
    const nodo = { ...base, data: { ...base.data, config: config([medio("a")]) } };

    releaseNodeResources(nodo as Parameters<typeof releaseNodeResources>[0]);

    expect(revocados).toContain(enlace);
    expect(enlaceDeSesion("a")).toBeNull();
  });

  it("un nodo de una herramienta sin recursos no falla", () => {
    const otro = createNodeDraft("tags", 0);
    expect(() => releaseNodeResources(otro as Parameters<typeof releaseNodeResources>[0])).not.toThrow();
  });
});

describe("duplicar no puede inventar un archivo que no existe", () => {
  it("la copia de un bloque pierde el nombre del archivo", () => {
    adjuntarArchivo("a", archivo("uno.mp4"));
    const items = [medio("a", "video", { fileName: "uno.mp4" })] as unknown as MessageItem[];

    const [original, copia] = duplicateItem(items, "a");

    expect((original as { fileName?: string }).fileName).toBe("uno.mp4");
    expect(copia.id).not.toBe("a");
    expect((copia as { fileName?: string }).fileName).toBe("");
    // Y no se le inventa un archivo en la sesión.
    expect(enlaceDeSesion(copia.id)).toBeNull();
  });

  it("la copia NO pasa la validación: pide que se elija un archivo", () => {
    // Es la invariante que importa. Antes valía por tener nombre, y al publicar
    // no habría habido nada que subir.
    const items = [medio("a", "video", { fileName: "uno.mp4" })] as unknown as MessageItem[];
    const [, copia] = duplicateItem(items, "a");

    expect(validateMessageContent({}, { items: [copia] }).valido).toBe(false);
    expect(validateMessageContent({}, { items }).valido).toBe(true);
  });

  it("el ENLACE sí se conserva: es un dato, no una referencia a memoria", () => {
    const items = [
      medio("a", "image", { url: "https://cdn.test/f.png", fileName: "" })
    ] as unknown as MessageItem[];

    const [, copia] = duplicateItem(items, "a");

    expect((copia as { url: string }).url).toBe("https://cdn.test/f.png");
    expect(validateMessageContent({}, { items: [copia] }).valido).toBe(true);
  });

  it("duplicar el NODO entero sigue la misma regla", () => {
    const copia = duplicateMessageConfig({
      items: [
        medio("a", "video", { fileName: "uno.mp4" }),
        medio("b", "image", { url: "https://cdn.test/f.png" })
      ]
    });

    const items = copia.items as ReadonlyArray<Record<string, unknown>>;
    expect(items[0].fileName).toBe("");
    expect(items[1].url).toBe("https://cdn.test/f.png");
  });

  it("texto y pausa se copian intactos", () => {
    const copia = duplicateMessageConfig({
      items: [
        { id: "t", kind: "text", text: "Hola" },
        { id: "p", kind: "interval", amount: 5, unit: "seconds" }
      ]
    });

    const items = copia.items as ReadonlyArray<Record<string, unknown>>;
    expect(items[0].text).toBe("Hola");
    expect(items[1].amount).toBe(5);
  });
});
