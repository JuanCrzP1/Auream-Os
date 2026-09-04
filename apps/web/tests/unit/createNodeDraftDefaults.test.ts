import { describe, expect, it } from "vitest";
import { createNodeDraft } from "@features/automations/builder/services/createNodeDraft";
import { getTool } from "@features/automations/builder/tools/registry";

// ---------------------------------------------------------------------------
// Independencia de los valores por defecto de una herramienta.
//
// Una definición de herramienta se declara UNA vez, en el ámbito del módulo, y
// vive lo que vive la pestaña. Si un nodo nuevo se queda con una referencia a
// esa estructura en lugar de con una copia, el objeto del registry pasa a ser
// estado mutable compartido: añadir una etiqueta a un nodo la añadiría también
// al siguiente que se arrastre al lienzo, y al siguiente, hasta recargar.
//
// La copia superficial NO basta. `{ ...defaultConfig }` duplica el primer nivel
// y deja los hijos compartidos, que es justo donde vive la estructura: hoy
// `tags` declara `{ tags: [] }` y `menu` declara `{ options: [] }`.
//
// Se prueba sobre `tags` y `menu` porque son las dos herramientas que hoy
// declaran forma anidada. El resto tiene `defaultConfig: {}` a propósito, y no
// puede demostrar nada sobre profundidad.
// ---------------------------------------------------------------------------

describe("createNodeDraft — defaults independientes entre nodos", () => {
  it("dos nodos de la misma herramienta no comparten el objeto de configuración", () => {
    const primero = createNodeDraft("tags", 1);
    const segundo = createNodeDraft("tags", 2);

    expect(primero.data.config).not.toBe(segundo.data.config);
    expect(primero.data.config).toEqual(segundo.data.config);
  });

  it("tampoco comparten los arrays anidados", () => {
    const primero = createNodeDraft("tags", 1);
    const segundo = createNodeDraft("tags", 2);

    expect(primero.data.config.tags).not.toBe(segundo.data.config.tags);
  });

  it("tampoco comparten los objetos anidados", () => {
    const primero = createNodeDraft("menu", 1);
    const segundo = createNodeDraft("menu", 2);

    expect(primero.data.config.options).not.toBe(segundo.data.config.options);
  });

  it("no comparten el contenido inicial", () => {
    const primero = createNodeDraft("tags", 1);
    const segundo = createNodeDraft("tags", 2);

    expect(primero.data.content).not.toBe(segundo.data.content);
    expect(primero.data.content).toEqual(segundo.data.content);
  });

  it("respeta el contenido inicial que declara la herramienta", () => {
    // Mensaje nace SIN `content.text`: su contenido es `config.items`, y
    // arrastrar un `text` heredado sería la misma información en dos sitios
    // desde el primer día.
    expect(createNodeDraft("message", 1).data.content).toEqual({});
    expect(createNodeDraft("message", 1).data.config).toEqual({ items: [] });
  });

  it("configurar un nodo no altera al otro", () => {
    const primero = createNodeDraft("tags", 1);
    const segundo = createNodeDraft("tags", 2);

    (primero.data.config.tags as string[]).push("cliente");

    expect(segundo.data.config.tags).toEqual([]);
  });

  it("editar el contenido de un nodo no altera al otro", () => {
    const primero = createNodeDraft("tags", 1);
    const segundo = createNodeDraft("tags", 2);

    primero.data.content.text = "Hola de nuevo";

    expect(segundo.data.content.text).toBe(getTool("tags")?.defaultContentText);
  });
});

describe("createNodeDraft — el registry no se contamina", () => {
  it("configurar un nodo no muta el default declarado por la herramienta", () => {
    const nodo = createNodeDraft("tags", 1);

    (nodo.data.config.tags as string[]).push("cliente");

    expect(getTool("tags")?.defaultConfig.tags).toEqual([]);
  });

  it("un nodo creado después sigue naciendo limpio", () => {
    const primero = createNodeDraft("menu", 1);
    (primero.data.config.options as string[]).push("Opción contaminada");

    const posterior = createNodeDraft("menu", 2);

    expect(posterior.data.config.options).toEqual([]);
  });
});

describe("createNodeDraft — el resto del nodo no cambia", () => {
  it("conserva id, tipo, posición y metadatos", () => {
    const nodo = createNodeDraft("tags", 1);

    expect(nodo.id).toContain("tags");
    expect(nodo.type).toBe("flowNode");
    expect(nodo.data.nodeType).toBe("tags");
    expect(nodo.position).toEqual({ x: 276, y: 380 });
    expect(nodo.data.metadata.ui).toEqual({ x: 276, y: 380 });
  });

  it("nace con los valores que declara su herramienta", () => {
    const tool = getTool("tags");
    const nodo = createNodeDraft("tags", 1);

    expect(nodo.data.title).toBe(tool?.label);
    expect(nodo.data.config).toEqual(tool?.defaultConfig);
    expect(nodo.data.isTerminal).toBe(tool?.terminal);
    expect(nodo.data.isEntry).toBe(false);
  });

  it("la posición y los metadatos no comparten el mismo objeto", () => {
    const nodo = createNodeDraft("tags", 1);

    expect(nodo.data.metadata.ui).not.toBe(nodo.position);
    expect(nodo.data.metadata.ui).toEqual(nodo.position);
  });
});
