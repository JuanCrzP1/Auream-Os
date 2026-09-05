import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { NodeExpandedFrame } from "@features/automations/builder/components/canvas/NodeExpandedFrame";
import { applyNodePatch } from "@features/automations/builder/services/applyNodePatch";
import { createNodeDraft } from "@features/automations/builder/services/createNodeDraft";
import { resolveTool } from "@features/automations/builder/tools/registry";
import { resolveToolUi } from "@features/automations/builder/tools/ui-registry";
import { readMessageItems } from "@features/automations/builder/tools/message/readMessageConfig";
import { soltarArchivo } from "@features/automations/builder/tools/message/mediaSourceSession";
import type { CanvasNode } from "@features/automations/builder/types/canvas";

// ---------------------------------------------------------------------------
// El medio sobrevive a cerrar y reabrir el nodo.
//
// Se recorre el camino COMPLETO y real, sin atajos: editor → «Guardar» →
// `applyNodePatch` (el mismo mutador del builder) → nodo → reapertura del
// editor con ese nodo. Si el dato se pierde en cualquier tramo, aquí se ve.
//
// LO QUE ESTAS PRUEBAS DISTINGUEN, y es la clave del asunto: un ENLACE es un
// dato y viaja; un ARCHIVO LOCAL es un `File` del navegador y no puede viajar
// —no hay dónde subirlo todavía—. Perder lo primero sería un defecto; lo
// segundo es una limitación declarada del sistema, y se prueba como tal para
// que nadie la confunda con un fallo.
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
function abrir(nodo: CanvasNode) {
  const onCommit = vi.fn();
  const onClose = vi.fn();

  const utils = render(
    <NodeExpandedFrame
      data={nodo.data}
      tool={resolveTool("message")}
      ui={resolveToolUi("message")}
      onCommit={onCommit}
      onClose={onClose}
    />
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
// El archivo local: la limitación, probada como limitación.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Archivo del dispositivo: qué sobrevive y qué no.
//
// Se separan dos cosas que antes iban juntas: los BYTES no sobreviven —no hay
// dónde subirlos— pero la ELECCIÓN sí, porque es información del mensaje.
// ---------------------------------------------------------------------------

/** Elige un archivo por el diálogo del sistema. */
function elegirArchivo(container: HTMLElement, nombre: string, tipo: string) {
  const input = container.querySelector<HTMLInputElement>(".media-file__input")!;
  const archivo = new File(["x"], nombre, { type: tipo });
  Object.defineProperty(input, "files", { value: [archivo], configurable: true });
  fireEvent.change(input);
}

describe.each(MEDIOS)("$kind configurado por ARCHIVO", ({ kind }) => {
  const nombre = `elegido-${kind}.bin`;

  it("Guardar está PERMITIDO: una fuente basta", () => {
    const nodo = nodoCon([{ id: "m1", kind, url: "", caption: "", sendOnce: false }]);
    const editor = abrir(nodo);

    elegirArchivo(editor.container, nombre, "application/octet-stream");
    const guardado = guardar(nodo, editor.onCommit);

    // No se rechazó: no hay aviso y el parche llegó al nodo.
    expect(screen.queryByRole("alert")).toBeNull();
    expect(editor.onClose).toHaveBeenCalledTimes(1);

    // Y la ELECCIÓN quedó registrada en la configuración.
    const enElNodo = readMessageItems(guardado.data.config, guardado.data.content);
    expect(enElNodo[0]).toMatchObject({ kind, url: "", fileName: nombre });
  });

  it("ESTADO 1 — reabrir con los bytes aún en sesión: se ve el archivo real", () => {
    const nodo = nodoCon([{ id: "m1", kind, url: "", caption: "", sendOnce: false }]);
    const editor = abrir(nodo);
    elegirArchivo(editor.container, nombre, "application/octet-stream");
    const guardado = guardar(nodo, editor.onCommit);
    editor.unmount();

    const reabierto = abrir(guardado);

    // No vuelve al estado vacío, y NO aparece el aviso de pendiente: los bytes
    // siguen ahí, así que se enseña el archivo de verdad.
    expect(reabierto.container.querySelector(".media-file__hint")).toBeNull();
    expect(reabierto.container.textContent).not.toContain("Se volverá a adjuntar");

    // Cada tipo se representa como le corresponde.
    if (kind === "image") {
      expect(reabierto.container.querySelector("img.media-file__media")).not.toBeNull();
    } else if (kind === "video") {
      expect(reabierto.container.querySelector("video.media-file__media")).not.toBeNull();
    } else if (kind === "audio") {
      expect(reabierto.container.querySelector(".media-audio")).not.toBeNull();
    } else {
      expect(reabierto.container.querySelector(".media-file__name")?.textContent).toBe(nombre);
    }

    // Y se puede volver a guardar sin reelegir nada.
    fireEvent.change(screen.getByLabelText(/^Descripción/), { target: { value: "x" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    expect(screen.queryByRole("alert")).toBeNull();
    reabierto.unmount();
  });

  it("ESTADO 2 — sin los bytes: consta la elección y se dice con honestidad", () => {
    const nodo = nodoCon([{ id: "m1", kind, url: "", caption: "", sendOnce: false }]);
    const editor = abrir(nodo);
    elegirArchivo(editor.container, nombre, "application/octet-stream");
    const guardado = guardar(nodo, editor.onCommit);
    editor.unmount();

    // Se simula una recarga: la configuración sobrevive, los bytes no.
    soltarArchivo("m1");

    const reabierto = abrir(guardado);

    // Ni zona vacía ni imagen inventada: el nombre y el estado pendiente.
    expect(reabierto.container.querySelector(".media-file__hint")).toBeNull();
    expect(reabierto.container.querySelector(".media-file__media")).toBeNull();
    expect(reabierto.container.querySelector(".media-file__name")?.textContent).toBe(nombre);
    expect(reabierto.container.textContent).toContain("Se volverá a adjuntar al publicar");

    // Y SIGUE SIENDO VÁLIDO: la elección consta, así que se puede guardar.
    fireEvent.change(screen.getByLabelText(/^Descripción/), { target: { value: "x" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    expect(screen.queryByRole("alert")).toBeNull();
    reabierto.unmount();
  });
});

describe("los bytes del archivo son la limitación real, y está acotada", () => {
  it("no se guarda el contenido del archivo, solo su nombre", () => {
    const nodo = nodoCon([{ id: "m1", kind: "image", url: "", caption: "", sendOnce: false }]);
    const editor = abrir(nodo);

    elegirArchivo(editor.container, "foto.png", "image/png");
    const guardado = guardar(nodo, editor.onCommit);

    // Ni bytes, ni blob URL: solo el nombre, que es un dato del mensaje.
    const serializado = JSON.stringify(guardado.data.config);
    expect(serializado).toContain("foto.png");
    expect(serializado).not.toContain("blob:");
    // El enlace real sigue vacío: nadie finge que esté subido.
    expect(readMessageItems(guardado.data.config, {})[0]).toMatchObject({ url: "" });
  });
});
