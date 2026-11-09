import { describe, expect, it } from "vitest";
import { listAllTools } from "../../apps/web/src/features/automations/builder/tools/registry.js";
import { BLOCK_CATALOG, findBlockRules } from "../../contracts/blocks/blockCatalog.js";
import { SINGLE_OUTPUT_NODE_TYPES } from "../../contracts/FlowConnectionRules.js";

// ---------------------------------------------------------------------------
// Las reglas de un bloque viven UNA vez (`contracts/blocks/blockCatalog.ts`):
// el editor web les suma lo visual y el servidor MCP las usa tal cual. Este
// test impide que una herramienta del editor declare reglas propias (que un
// agente y una persona vean bloques distintos).
// ---------------------------------------------------------------------------

describe("catálogo de bloques ↔ herramientas del editor", () => {
  it("cada herramienta del editor usa las reglas del catálogo, sin copias propias", () => {
    const tools = listAllTools();
    expect(tools.map((tool) => tool.type).sort()).toEqual(BLOCK_CATALOG.map((block) => block.type).sort());
    for (const tool of tools) {
      const rules = findBlockRules(tool.type)!;
      for (const key of ["label", "defaultContent", "defaultConfig", "availableInPalette", "terminal", "outputs", "validate", "normalizeConfig"] as const) {
        expect(tool[key], `${tool.type}.${key}`).toBe(rules[key]);
      }
    }
  });

  it("los bloques de salida única son exactamente los que no declaran salidas", () => {
    const single = BLOCK_CATALOG.filter((block) => !block.outputs && !block.terminal).map((block) => block.type).sort();
    expect(single).toEqual([...SINGLE_OUTPUT_NODE_TYPES].sort());
  });

  it("la forma canónica conserva la configuración por defecto (normalizar no cambia un bloque recién creado)", () => {
    for (const block of BLOCK_CATALOG) expect(block.normalizeConfig(block.defaultConfig), block.type).toEqual(block.defaultConfig);
  });
});
