import { describe, expect, it } from "vitest";
import {
  getTool,
  findTool,
  resolveTool,
  listAllTools,
  listPaletteTools,
  isTerminalType,
  isExecutableType
} from "@features/automations/builder/tools/registry";
import { getToolIcon, listIconTypes } from "@features/automations/builder/tools/icons";
import { createNodeDraft } from "@features/automations/builder/services/createNodeDraft";

// ---------------------------------------------------------------------------
// Contrato del registry de herramientas.
//
// Se valida comportamiento y contrato, no texto exacto ni detalles visuales:
// cambiar el color o afinar una descripción no debe romper estos tests, pero
// registrar mal una herramienta sí.
// ---------------------------------------------------------------------------

/** Catálogo oficial de AUREAM OS, en el orden acordado para la paleta. */
const OFFICIAL_PALETTE_TYPES = [
  "message",
  "question",
  "tags",
  "payment-proof",
  "condition",
  "distributor",
  "pixel",
  "ai",
  "delay",
  "sale-approved",
  "integration",
  "menu",
  "notification"
] as const;

/** Herramientas retiradas: no deben volver por ninguna vía. */
const REMOVED_TYPES = ["capture", "action", "fallback"] as const;

describe("registry de herramientas", () => {
  it("registra las 13 herramientas del catálogo oficial", () => {
    for (const type of OFFICIAL_PALETTE_TYPES) {
      expect(getTool(type), `falta la herramienta '${type}'`).not.toBeNull();
    }

    expect(listPaletteTools()).toHaveLength(OFFICIAL_PALETTE_TYPES.length);
  });

  it("ofrece las 13 en la paleta y en el orden acordado", () => {
    expect(listPaletteTools().map((tool) => tool.type)).toEqual([...OFFICIAL_PALETTE_TYPES]);
  });

  it("no ofrece las herramientas retiradas", () => {
    for (const type of REMOVED_TYPES) {
      expect(findTool(type), `'${type}' sigue registrada`).toBeNull();
    }

    const paletteTypes = listPaletteTools().map((tool) => tool.type as string);
    for (const type of REMOVED_TYPES) {
      expect(paletteTypes).not.toContain(type);
    }
  });

  it("mantiene `end` como nodo de sistema: registrado pero fuera de la paleta", () => {
    const end = getTool("end");

    expect(end).not.toBeNull();
    expect(end?.availableInPalette).toBe(false);
    expect(isTerminalType("end")).toBe(true);
    expect(listPaletteTools().map((tool) => tool.type)).not.toContain("end");
  });

  it("da a cada herramienta una definición completa y utilizable", () => {
    for (const tool of listAllTools()) {
      expect(tool.label.length, `${tool.type} sin label`).toBeGreaterThan(0);
      expect(tool.description.length, `${tool.type} sin descripción`).toBeGreaterThan(0);
      expect(tool.editorTitle.length, `${tool.type} sin título de editor`).toBeGreaterThan(0);
      expect(tool.glyph.length, `${tool.type} sin glifo`).toBeGreaterThan(0);
      expect(tool.colors.header, `${tool.type} sin color`).toMatch(/^#[0-9a-f]{6}$/i);
      expect(tool.colors.gradient.length).toBeGreaterThan(0);
      expect(typeof tool.executable).toBe("boolean");
      expect(tool.defaultConfig).toBeTypeOf("object");
    }
  });

  it("no tiene tipos duplicados", () => {
    const types = listAllTools().map((tool) => tool.type);
    expect(new Set(types).size).toBe(types.length);
  });

  it("declara si el motor sabe ejecutar cada herramienta, sin fingir capacidad", () => {
    // Las herramientas sin comportamiento de ejecución deben declararlo: su
    // handler falla explícitamente con `*_not_implemented`.
    expect(isExecutableType("message")).toBe(true);
    expect(isExecutableType("question")).toBe(true);
    expect(isExecutableType("tags")).toBe(false);
    expect(isExecutableType("menu")).toBe(false);
  });

  it("degrada un tipo desconocido en lugar de romper el canvas", () => {
    const unknown = resolveTool("herramienta-de-otra-version");

    expect(findTool("herramienta-de-otra-version")).toBeNull();
    expect(unknown.colors.header).toMatch(/^#[0-9a-f]{6}$/i);
    expect(unknown.availableInPalette).toBe(false);
  });
});

describe("creación de nodo desde el registry", () => {
  it("crea un nodo inicial válido para cada herramienta de la paleta", () => {
    for (const tool of listPaletteTools()) {
      const node = createNodeDraft(tool.type, 1);

      expect(node.id).toContain(tool.type);
      expect(node.type).toBe("flowNode");
      expect(node.data.nodeType).toBe(tool.type);
      expect(node.data.title).toBe(tool.label);
      expect(node.data.isTerminal).toBe(tool.terminal);
      expect(node.data.config).toEqual(tool.defaultConfig);
      expect(node.position).toEqual(node.data.metadata.ui);
    }
  });

  it("no comparte el objeto de configuración entre dos nodos", () => {
    const first = createNodeDraft("tags", 1);
    const second = createNodeDraft("tags", 2);

    expect(first.data.config).not.toBe(second.data.config);
    expect(first.data.config).toEqual(second.data.config);
  });
});

// ---------------------------------------------------------------------------
// El catálogo está declarado en dos sitios que tienen que ir juntos: la
// definición de cada herramienta (`registry`, puro) y su icono (`icons`, React).
// Están separados a propósito —una regla de validación no puede arrastrar JSX—
// pero esa separación abre un hueco: una herramienta sin icono registrado se
// pintaba en la paleta sin él, sin error y sin que ningún test lo notara.
//
// La paridad con la validación del backend la cubre
// `tests/contract/toolRegistryParity.test.ts`; esta es la del frontend.
// ---------------------------------------------------------------------------

describe("paridad catálogo ↔ iconografía", () => {
  it("toda herramienta registrada tiene icono", () => {
    for (const tool of listAllTools()) {
      expect(getToolIcon(tool.type), `la herramienta '${tool.type}' no tiene icono`).not.toBeNull();
    }
  });

  it("no hay iconos registrados para tipos que ninguna herramienta declara", () => {
    const declarados = new Set(listAllTools().map((tool) => tool.type));

    for (const type of listIconTypes()) {
      expect(declarados.has(type), `hay icono para '${type}', que no está en el registry`).toBe(true);
    }
  });

  it("cada herramienta trae lo mínimo para poder pintarse", () => {
    for (const tool of listAllTools()) {
      expect(tool.label.trim(), `'${tool.type}' sin etiqueta`).not.toBe("");
      expect(tool.description.trim(), `'${tool.type}' sin descripción`).not.toBe("");
      expect(tool.glyph.trim(), `'${tool.type}' sin glifo`).not.toBe("");
      expect(tool.colors.header, `'${tool.type}' sin color de cabecera`).toMatch(/^#|^linear-/);
      expect(tool.colors.gradient, `'${tool.type}' sin degradado`).toContain("gradient");
    }
  });
});
