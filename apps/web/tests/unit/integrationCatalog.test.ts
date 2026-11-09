import { describe, expect, it } from "vitest";
import { buildEntries, combineStatus, connectedLabel, filterEntries, splitByActivity, type IntegrationDefinition } from "../../src/features/integrations/catalog/integrationCatalog";
import { INTEGRATION_DEFINITIONS, findIntegration } from "../../src/features/integrations/catalog/integrationRegistry";

// El modelo del centro de Integraciones: definiciones + conteos, filtro por
// categoría y búsqueda (sin tildes), activas primero.

const DEFS: IntegrationDefinition[] = [
  { id: "openai", category: "ai", name: "OpenAI", tagline: "Modelos GPT", mark: "openai", unit: { one: "conexión", many: "conexiones" } },
  { id: "meta-pixel", category: "tracking", name: "Píxel de Meta", tagline: "API de Conversiones", mark: "meta", unit: { one: "píxel", many: "píxeles" }, keywords: ["facebook"] },
  { id: "gemini", category: "ai", name: "Google Gemini", tagline: "Modelos de Google", mark: "gemini", unit: { one: "conexión", many: "conexiones" } }
];

describe("catálogo de integraciones", () => {
  it("une definiciones con los conteos de todas las fuentes (sin conteo, 0)", () => {
    const entries = buildEntries(DEFS, [{ counts: { openai: 2 } }, { counts: { "meta-pixel": 1 } }]);
    expect(entries.map((entry) => [entry.id, entry.connected])).toEqual([["openai", 2], ["meta-pixel", 1], ["gemini", 0]]);
    expect(entries.map(connectedLabel)).toEqual(["2 conexiones", "1 píxel", "0 conexiones"]);
  });

  it("filtra por categoría y busca por nombre, descripción, categoría o palabra clave, sin tildes", () => {
    const entries = buildEntries(DEFS, []);
    expect(filterEntries(entries, "ai", "").map((entry) => entry.id)).toEqual(["openai", "gemini"]);
    expect(filterEntries(entries, "all", "pixel").map((entry) => entry.id)).toEqual(["meta-pixel"]);
    expect(filterEntries(entries, "all", "FACEBOOK").map((entry) => entry.id)).toEqual(["meta-pixel"]);
    expect(filterEntries(entries, "all", "inteligencia").map((entry) => entry.id)).toEqual(["openai", "gemini"]);
    expect(filterEntries(entries, "tracking", "gpt")).toEqual([]);
  });

  it("separa activas de disponibles, cada grupo por nombre; el estado combina las fuentes", () => {
    const { active, available } = splitByActivity(buildEntries(DEFS, [{ counts: { gemini: 1, openai: 3 } }]));
    expect([active.map((entry) => entry.id), available.map((entry) => entry.id)]).toEqual([["gemini", "openai"], ["meta-pixel"]]);
    expect([combineStatus(["ready", "loading"]), combineStatus(["ready", "error"]), combineStatus(["error", "error"]), combineStatus(["ready", "forbidden"])]).toEqual(["loading", "ready", "error", "ready"]);
  });

  it("el registro: ids únicos, cada integración con su panel", () => {
    const ids = INTEGRATION_DEFINITIONS.map((definition) => definition.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(findIntegration(id)?.Panel).toBeTypeOf("function");
    expect(findIntegration("no-existe")).toBeNull();
  });
});
