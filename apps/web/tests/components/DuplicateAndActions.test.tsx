import { describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MessageEditor } from "@features/automations/builder/tools/message/MessageEditor";
import { useCanvasNodes } from "@features/automations/builder/hooks/canvas/useCanvasNodes";
import { duplicateNodeDraft } from "@features/automations/builder/services/duplicateNodeDraft";
import { mapCanvasToSnapshot } from "@features/automations/builder/adapters/mapCanvasToSnapshot";
import { readMessageItems } from "@features/automations/builder/tools/message/readMessageConfig";
import type { CanvasNode } from "@features/automations/builder/types/canvas";
import type { BuilderFlowSnapshot } from "@contracts/FlowSnapshot";
import type { NodePatch } from "@features/automations/builder/services/applyNodePatch";

// ---------------------------------------------------------------------------
// Dos cosas distintas que comparten nombre: duplicar un BLOQUE dentro de un
// Mensaje, y duplicar el NODO Mensaje entero desde el lienzo.
//
// Lo que se persigue en ambos casos es lo mismo: que la copia lleve TODO lo
// que el usuario configuró. Una copia vacía es peor que no tener el botón,
// porque parece que funcionó.
// ---------------------------------------------------------------------------

const SECUENCIA = [
  { id: "t1", kind: "text", text: "Hola {{context.nombre}}" },
  { id: "m2", kind: "image", url: "https://cdn.test/foto.png", caption: "Cartel", sendOnce: true },
  { id: "m3", kind: "video", url: "https://cdn.test/clip.mp4", caption: "Demo", sendOnce: false },
  { id: "m4", kind: "audio", url: "https://cdn.test/voz.mp3", caption: "Nota", sendOnce: true },
  { id: "m5", kind: "file", url: "https://cdn.test/doc.pdf", caption: "Bases", sendOnce: true },
  { id: "i6", kind: "interval", amount: 45, unit: "minutes" }
];

function renderEditor(items: unknown[]) {
  const onChange = vi.fn<(patch: NodePatch) => void>();

  const utils = render(
    <MessageEditor draft={{ name: "M", content: {}, config: { items } }} onChange={onChange} />
  );

  const lastItems = () =>
    (onChange.mock.lastCall?.[0].config?.items ?? []) as Array<Record<string, unknown>>;

  return { ...utils, lastItems };
}

const secuencia = () => screen.getByRole("list", { name: "Contenidos del mensaje" });

// ---------------------------------------------------------------------------

describe("las acciones del bloque están siempre presentes", () => {
  it("las cuatro se renderizan sin necesidad de pasar el ratón", () => {
    renderEditor([SECUENCIA[0]]);

    for (const accion of [/^Subir/, /^Bajar/, /^Duplicar/, /^Eliminar/]) {
      expect(screen.getByRole("button", { name: accion })).toBeTruthy();
    }
  });

  it("ninguna se oculta con opacidad cero ni con display none", () => {
    const { container } = renderEditor([SECUENCIA[0]]);

    const contenedor = container.querySelector(".message-item__actions") as HTMLElement;
    // El defecto que este test impide: acciones que solo existen al pasar el
    // ratón, y que por tanto se descubren por casualidad.
    expect(contenedor.style.opacity).not.toBe("0");
    expect(contenedor.style.display).not.toBe("none");
    expect(within(contenedor).getAllByRole("button")).toHaveLength(4);
  });

  it("cada acción dice qué hace y sobre qué bloque", () => {
    renderEditor([SECUENCIA[1]]);

    for (const nombre of ["Subir Imagen", "Bajar Imagen", "Duplicar Imagen", "Eliminar Imagen"]) {
      expect(screen.getByRole("button", { name: nombre })).toBeTruthy();
    }
  });

  it("son alcanzables con el teclado", () => {
    renderEditor([SECUENCIA[0], SECUENCIA[1]]);

    const duplicar = screen.getAllByRole("button", { name: /^Duplicar/ })[0];
    duplicar.focus();

    expect(document.activeElement).toBe(duplicar);
  });
});

describe("duplicar un BLOQUE conserva todo su contenido", () => {
  const casos = [
    ["Texto", 0, { kind: "text", text: "Hola {{context.nombre}}" }],
    ["Imagen", 1, { kind: "image", url: "https://cdn.test/foto.png", caption: "Cartel", sendOnce: true }],
    ["Video", 2, { kind: "video", url: "https://cdn.test/clip.mp4", caption: "Demo", sendOnce: false }],
    ["Audio", 3, { kind: "audio", url: "https://cdn.test/voz.mp3", caption: "Nota", sendOnce: true }],
    ["Archivo", 4, { kind: "file", url: "https://cdn.test/doc.pdf", caption: "Bases", sendOnce: true }],
    ["Intervalo", 5, { kind: "interval", amount: 45, unit: "minutes" }]
  ] as const;

  it.each(casos)("%s conserva su configuración", (_nombre, indice, esperado) => {
    const { lastItems } = renderEditor(SECUENCIA);

    fireEvent.click(screen.getAllByRole("button", { name: /^Duplicar/ })[indice]);

    // La copia va justo detrás del original.
    expect(lastItems()[indice + 1]).toMatchObject(esperado);
  });

  it("la copia recibe identidad nueva", () => {
    const { lastItems } = renderEditor(SECUENCIA);

    fireEvent.click(screen.getAllByRole("button", { name: /^Duplicar/ })[1]);

    const copia = lastItems()[2];
    expect(copia.id).not.toBe("m2");
    expect(copia).toMatchObject({ kind: "image", url: "https://cdn.test/foto.png" });
  });

  it("nunca crea una copia vacía", () => {
    const { lastItems } = renderEditor(SECUENCIA);

    fireEvent.click(screen.getAllByRole("button", { name: /^Duplicar/ })[4]);

    const copia = lastItems()[5];
    expect(copia.url).toBe("https://cdn.test/doc.pdf");
    expect(copia.caption).toBe("Bases");
    expect(copia.sendOnce).toBe(true);
  });

  it("el original queda intacto", () => {
    const { lastItems } = renderEditor(SECUENCIA);

    fireEvent.click(screen.getAllByRole("button", { name: /^Duplicar/ })[3]);

    expect(lastItems()[3]).toMatchObject({ id: "m4", url: "https://cdn.test/voz.mp3" });
    expect(within(secuencia()).getAllByRole("listitem")).toHaveLength(6);
  });
});

// ---------------------------------------------------------------------------

function makeNode(id: string, overrides: Partial<CanvasNode["data"]> = {}): CanvasNode {
  return {
    id,
    type: "flowNode",
    position: { x: 200, y: 140 },
    deletable: true,
    data: {
      nodeType: "message",
      title: "Saludo inicial",
      preview: "Hola",
      configSummary: "",
      isEntry: false,
      isTerminal: false,
      content: {},
      config: { items: SECUENCIA },
      metadata: { ui: { x: 200, y: 140 }, nota: "ajena" },
      ...overrides
    }
  };
}

describe("duplicar el NODO Mensaje desde el lienzo", () => {
  it("la copia lleva todos los bloques del original", () => {
    const copia = duplicateNodeDraft(makeNode("n1"), 2);

    expect(readMessageItems(copia.data.config, copia.data.content)).toHaveLength(6);
  });

  it("conserva el contenido de cada bloque, no solo su tipo", () => {
    const copia = duplicateNodeDraft(makeNode("n1"), 2);
    const items = readMessageItems(copia.data.config, copia.data.content);

    expect(items[0]).toMatchObject({ kind: "text", text: "Hola {{context.nombre}}" });
    expect(items[1]).toMatchObject({ kind: "image", url: "https://cdn.test/foto.png", sendOnce: true });
    expect(items[5]).toMatchObject({ kind: "interval", amount: 45, unit: "minutes" });
  });

  it("conserva tipo, nombre y metadatos ajenos", () => {
    const copia = duplicateNodeDraft(makeNode("n1"), 2);

    expect(copia.data.nodeType).toBe("message");
    expect(copia.data.title).toBe("Saludo inicial");
    expect(copia.data.metadata.nota).toBe("ajena");
  });

  it("recibe un id de nodo nuevo", () => {
    const copia = duplicateNodeDraft(makeNode("n1"), 2);

    expect(copia.id).not.toBe("n1");
  });

  it("cada bloque interno recibe identidad nueva", () => {
    const original = makeNode("n1");
    const copia = duplicateNodeDraft(original, 2);

    const idsOriginales = new Set(SECUENCIA.map((i) => i.id));
    const idsCopia = readMessageItems(copia.data.config, copia.data.content).map((i) => i.id);

    expect(idsCopia).toHaveLength(6);
    for (const id of idsCopia) expect(idsOriginales.has(id)).toBe(false);
  });

  it("aparece desplazada, no encima del original", () => {
    const copia = duplicateNodeDraft(makeNode("n1"), 2);

    expect(copia.position.x).toBeGreaterThan(200);
    expect(copia.position.y).toBeGreaterThan(140);
    // La posición que se persiste tiene que seguir a la que se dibuja.
    expect(copia.data.metadata.ui).toEqual(copia.position);
  });

  it("no comparte configuración con el original", () => {
    const original = makeNode("n1");
    const copia = duplicateNodeDraft(original, 2);

    expect(copia.data.config).not.toBe(original.data.config);
    (copia.data.config.items as Array<Record<string, unknown>>)[0].text = "cambiado";
    expect(SECUENCIA[0].text).toBe("Hola {{context.nombre}}");
  });

  it("la copia nunca hereda la condición de entrada", () => {
    const copia = duplicateNodeDraft(makeNode("n1", { isEntry: true }), 2);

    expect(copia.data.isEntry).toBe(false);
    expect(copia.deletable).toBe(true);
  });

  it("la copia nace cerrada aunque el original estuviera abierto", () => {
    const copia = duplicateNodeDraft(makeNode("n1", { isExpanded: true }), 2);

    expect(copia.data.isExpanded).toBe(false);
  });
});

describe("duplicar desde el estado del lienzo", () => {
  const base: BuilderFlowSnapshot = {
    flow: { id: "f", key: "f", name: "Flow" },
    version: { id: "v1", versionNumber: 1, status: "draft", entryNodeId: "inicio" },
    nodes: {},
    edgesBySource: {}
  };

  function renderCanvas() {
    const inicial = [
      makeNode("inicio", { isEntry: true }),
      makeNode("n1")
    ];
    inicial[0] = { ...inicial[0], deletable: false };
    return renderHook(() => useCanvasNodes(inicial, null));
  }

  it("añade la copia al lienzo", () => {
    const { result } = renderCanvas();

    act(() => result.current.duplicateNode("n1"));

    expect(result.current.nodes).toHaveLength(3);
  });

  it("la copia llega al snapshot con todos sus bloques", () => {
    const { result } = renderCanvas();

    act(() => result.current.duplicateNode("n1"));

    const snapshot = mapCanvasToSnapshot(base, result.current.nodes, []);
    const copia = Object.values(snapshot.nodes).find((n) => n.id !== "inicio" && n.id !== "n1")!;

    expect(readMessageItems(copia.config, copia.content)).toHaveLength(6);
  });

  it("INICIO no se duplica", () => {
    const { result } = renderCanvas();

    act(() => result.current.duplicateNode("inicio"));

    expect(result.current.nodes).toHaveLength(2);
    expect(result.current.canDuplicateNode("inicio")).toBe(false);
    expect(result.current.canDuplicateNode("n1")).toBe(true);
  });

  it("duplicar no altera el entryNodeId", () => {
    const { result } = renderCanvas();

    act(() => result.current.duplicateNode("n1"));

    const snapshot = mapCanvasToSnapshot(base, result.current.nodes, []);
    expect(snapshot.version.entryNodeId).toBe("inicio");
    expect(snapshot.nodes.inicio).toBeTruthy();
  });

  it("sigue habiendo un solo nodo de entrada", () => {
    const { result } = renderCanvas();

    act(() => result.current.duplicateNode("n1"));

    expect(result.current.nodes.filter((n) => n.data.isEntry)).toHaveLength(1);
  });

  it("ignora un id que no está en el lienzo", () => {
    const { result } = renderCanvas();

    act(() => result.current.duplicateNode("fantasma"));

    expect(result.current.nodes).toHaveLength(2);
  });
});
