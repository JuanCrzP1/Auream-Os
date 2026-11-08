import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { NodeExpandedFrame } from "@features/automations/builder/components/canvas/NodeExpandedFrame";
import { applyNodePatch } from "@features/automations/builder/services/applyNodePatch";
import { createNodeDraft } from "@features/automations/builder/services/createNodeDraft";
import { resolveTool } from "@features/automations/builder/tools/registry";
import { resolveToolUi } from "@features/automations/builder/tools/ui-registry";
import { readMessageItems } from "@features/automations/builder/tools/message/readMessageConfig";
import { releaseFile } from "@features/automations/builder/tools/message/mediaSourceSession";
import { StaticBuilderResourcesProvider } from "@features/automations/builder/context/BuilderResourcesContext";
import type { ToolResources } from "@features/automations/builder/tools/ToolResources";
import { MISSING_SOURCE_MESSAGE } from "@features/automations/builder/tools/message/validateMessageContent";
import type { CanvasNode } from "@features/automations/builder/types/canvas";

// ---------------------------------------------------------------------------
// El medio sobrevive a cerrar y reabrir el nodo.
//
// Se recorre el camino COMPLETO y real, sin atajos: editor → «Guardar» →
// `applyNodePatch` (el mismo mutador del builder) → nodo → reapertura del
// editor con ese nodo. Si el dato se pierde en cualquier tramo, aquí se ve.
//
// Dos fuentes, y las dos deben sobrevivir: un ENLACE escrito, y un ARCHIVO del
// dispositivo, que se SUBE al almacén de la cuenta al elegirlo y deja en el
// bloque su URL pública. Un archivo que no se subió no es enviable.
// ---------------------------------------------------------------------------

const MEDIOS = [
  { kind: "image", enlace: "https://cdn.test/fotos/playa.png" },
  { kind: "video", enlace: "https://cdn.test/clips/intro.mp4" },
  { kind: "audio", enlace: "https://cdn.test/voz/saludo.mp3" },
  { kind: "file", enlace: "https://cdn.test/docs/condiciones.pdf" }
] as const;

/** Un nodo Mensaje con la secuencia dada, como lo tendría el lienzo. */
function nodoCon(items: ReadonlyArray<Record<string, unknown>>): CanvasNode {
  const nodo = createNodeDraft("message", 0);
  return { ...nodo, data: { ...nodo.data, config: { items } } };
}

/** Abre el editor sobre un nodo y devuelve lo que «Guardar» confirmaría. */
function abrir(nodo: CanvasNode, resources: ToolResources = { labels: [] }) {
  const onCommit = vi.fn();
  const onClose = vi.fn();

  const utils = render(
    <StaticBuilderResourcesProvider resources={resources}>
      <NodeExpandedFrame
        data={nodo.data}
        tool={resolveTool("message")}
        ui={resolveToolUi("message")}
        onCommit={onCommit}
        onClose={onClose}
      />
    </StaticBuilderResourcesProvider>
  );

  return { ...utils, onCommit, onClose };
}

/** Pulsa «Guardar» y aplica el parche al nodo, como hace el builder. */
function guardar(nodo: CanvasNode, onCommit: ReturnType<typeof vi.fn>): CanvasNode {
  fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
  expect(onCommit).toHaveBeenCalledTimes(1);

  return applyNodePatch(nodo, onCommit.mock.calls[0][0]);
}

describe.each(MEDIOS)("$kind configurado por ENLACE sobrevive a cerrar y reabrir", ({
  kind,
  enlace
}) => {
  it("el enlace sigue ahí al reabrir el nodo", () => {
    const nodo = nodoCon([{ id: "m1", kind, url: "", caption: "", sendOnce: false }]);
    const editor = abrir(nodo);

    // Pestaña URL y enlace escrito, como haría el usuario.
    fireEvent.click(screen.getByRole("tab", { name: "URL" }));
    fireEvent.change(screen.getByLabelText("URL del archivo del bloque 1"), {
      target: { value: enlace }
    });

    const guardado = guardar(nodo, editor.onCommit);
    editor.unmount();

    // El nodo YA lleva el enlace: no se perdió al confirmar.
    const enElNodo = readMessageItems(guardado.data.config, guardado.data.content);
    expect(enElNodo).toHaveLength(1);
    expect(enElNodo[0]).toMatchObject({ kind, url: enlace });

    // Y al reabrir, el editor lo vuelve a mostrar.
    const reabierto = abrir(guardado);
    fireEvent.click(screen.getByRole("tab", { name: "URL" }));
    expect(
      (screen.getByLabelText("URL del archivo del bloque 1") as HTMLInputElement).value
    ).toBe(enlace);
    reabierto.unmount();
  });

  it("conserva los datos EXACTOS del bloque, no solo el enlace", () => {
    const nodo = nodoCon([
      { id: "m1", kind, url: enlace, caption: "Una descripción", sendOnce: true }
    ]);
    const editor = abrir(nodo);

    // Un cambio cualquiera para poder confirmar.
    fireEvent.change(screen.getByLabelText(/^Descripción/), {
      target: { value: "Descripción editada" }
    });
    const guardado = guardar(nodo, editor.onCommit);

    expect(readMessageItems(guardado.data.config, guardado.data.content)[0]).toEqual({
      id: "m1",
      kind,
      url: enlace,
      // Sin archivo del dispositivo: la otra fuente posible queda vacía.
      fileName: "",
      caption: "Descripción editada",
      sendOnce: true
    });
  });
});

describe("una secuencia mixta sobrevive entera", () => {
  it("texto, los cuatro medios y una pausa vuelven tal cual", () => {
    const items = [
      { id: "t1", kind: "text", text: "Hola" },
      ...MEDIOS.map((m, i) => ({
        id: `m${i}`,
        kind: m.kind,
        url: m.enlace,
        caption: "",
        sendOnce: false
      })),
      { id: "p1", kind: "interval", amount: 5, unit: "seconds" }
    ];
    const nodo = nodoCon(items);
    const editor = abrir(nodo);

    fireEvent.change(screen.getByLabelText("Texto del bloque 1"), {
      target: { value: "Hola de nuevo" }
    });
    const guardado = guardar(nodo, editor.onCommit);

    const vueltos = readMessageItems(guardado.data.config, guardado.data.content);
    expect(vueltos).toHaveLength(6);
    expect(vueltos.map((i) => i.kind)).toEqual([
      "text",
      "image",
      "video",
      "audio",
      "file",
      "interval"
    ]);
    // Los enlaces de los cuatro medios, intactos.
    expect(vueltos.slice(1, 5).map((i) => (i as { url: string }).url)).toEqual(
      MEDIOS.map((m) => m.enlace)
    );
  });
});

// ---------------------------------------------------------------------------
// Archivo del dispositivo: se sube al almacén de la cuenta y el bloque guarda
// su URL. Sobrevive a recargar porque ya no depende de la memoria del navegador.
// ---------------------------------------------------------------------------

const TIPOS = { image: "image/png", video: "video/mp4", audio: "audio/mpeg", file: "application/pdf" } as const;

/** Elige un archivo por el diálogo del sistema. */
function elegirArchivo(container: HTMLElement, nombre: string, tipo: string) {
  const input = container.querySelector<HTMLInputElement>(".media-file__input")!;
  const archivo = new File(["x"], nombre, { type: tipo });
  Object.defineProperty(input, "files", { value: [archivo], configurable: true });
  fireEvent.change(input);
}

/** Almacén falso: «sube» y devuelve una URL pública estable. */
const almacen = (fallo?: string): ToolResources => ({
  labels: [],
  uploadMedia: vi.fn(async (file: File, kind) =>
    fallo
      ? { ok: false as const, message: fallo }
      : { ok: true as const, value: { id: "media-1", kind, url: `https://blob.test/${file.name}`, contentType: file.type, size: file.size, fileName: file.name, createdAt: "x" } }
  )
});

describe.each(MEDIOS)("$kind configurado por ARCHIVO", ({ kind }) => {
  const nombre = `elegido-${kind}.${kind === "file" ? "pdf" : "bin"}`;

  it("se sube al elegirlo y el bloque guarda su URL, su nombre y su registro", async () => {
    const recursos = almacen();
    const nodo = nodoCon([{ id: "m1", kind, url: "", caption: "", sendOnce: false }]);
    const editor = abrir(nodo, recursos);

    elegirArchivo(editor.container, nombre, TIPOS[kind]);
    expect(await screen.findByText("Guardado")).toBeTruthy();
    const guardado = guardar(nodo, editor.onCommit);

    expect(recursos.uploadMedia).toHaveBeenCalledWith(expect.any(File), kind, expect.any(Function));
    expect(readMessageItems(guardado.data.config, guardado.data.content)[0]).toMatchObject({
      kind,
      url: `https://blob.test/${nombre}`,
      fileName: nombre,
      mediaId: "media-1"
    });
    expect(JSON.stringify(guardado.data.config)).not.toContain("blob:http");
  });

  it("al reabrir en otra sesión (sin los bytes) se ve desde su URL guardada", () => {
    const nodo = nodoCon([{ id: "m1", kind, url: `https://blob.test/${nombre}`, fileName: nombre, mediaId: "media-1", caption: "", sendOnce: false }]);
    releaseFile("m1");
    const reabierto = abrir(nodo, almacen());

    expect(reabierto.container.querySelector(".media-file__hint")).toBeNull();
    if (kind === "image") {
      expect(reabierto.container.querySelector<HTMLImageElement>("img.media-file__media")?.src).toBe(`https://blob.test/${nombre}`);
    } else if (kind === "video") {
      expect(reabierto.container.querySelector("video.media-file__media")).not.toBeNull();
    } else if (kind === "audio") {
      expect(reabierto.container.querySelector(".media-audio")).not.toBeNull();
    } else {
      expect(reabierto.container.querySelector(".media-file__name")?.textContent).toBe(nombre);
    }

    // Se puede volver a guardar sin reelegir nada.
    fireEvent.change(screen.getByLabelText(/^Descripción/), { target: { value: "x" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    expect(screen.queryByRole("alert")).toBeNull();
    reabierto.unmount();
  });

  it("un archivo de antes (solo el nombre, sin subir) avisa y no deja guardar", () => {
    const nodo = nodoCon([{ id: "m1", kind, url: "", fileName: nombre, caption: "", sendOnce: false }]);
    releaseFile("m1");
    const reabierto = abrir(nodo, almacen());

    expect(reabierto.container.textContent).toContain("No se guardó: vuelve a elegir el archivo");
    fireEvent.change(screen.getByLabelText(/^Descripción/), { target: { value: "x" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    expect(screen.getByRole("alert").textContent).toContain(MISSING_SOURCE_MESSAGE);
    reabierto.unmount();
  });
});

describe("si la subida falla", () => {
  it("lo explica y el bloque no queda a medias", async () => {
    const nodo = nodoCon([{ id: "m1", kind: "image", url: "", caption: "", sendOnce: false }]);
    const editor = abrir(nodo, almacen("La imagen supera el máximo de WhatsApp (5 MB)."));

    elegirArchivo(editor.container, "enorme.png", "image/png");
    expect((await screen.findByText(/supera el máximo de WhatsApp/)).textContent).toContain("5 MB");
    expect(editor.container.querySelector(".media-file__hint")).not.toBeNull();
    editor.unmount();
  });
});
