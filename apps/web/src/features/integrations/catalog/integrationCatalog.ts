import type { AiProviderId } from "@contracts/AiContracts";
import type { ConnectionListStatus } from "../components/IntegrationSection";

// ---------------------------------------------------------------------------
// Catálogo de integraciones — el MODELO del centro de Integraciones (puro,
// sin React):
//
//   definición   lo fijo de cada integración: categoría, nombre, para qué
//                sirve, distintivo (el registro `integrationRegistry`)
//   fuente       cuántas hay conectadas de cada una, en vivo (IA, Meta,
//                webhooks, MCP…): `IntegrationSourceState`
//   entrada      definición + conteo: lo que pinta el centro
//
// La pantalla solo filtra, busca y separa activas de disponibles. Agregar una
// integración = su definición y su panel en el registro, y su fuente.
// ---------------------------------------------------------------------------

export type IntegrationCategoryId = "ai" | "tracking" | "automation" | "agents";

export const INTEGRATION_CATEGORIES: ReadonlyArray<{ readonly id: IntegrationCategoryId; readonly label: string }> = [
  { id: "ai", label: "Inteligencia artificial" },
  { id: "tracking", label: "Seguimiento" },
  { id: "automation", label: "Automatización" },
  { id: "agents", label: "Agentes de IA" }
];

export function categoryLabel(id: IntegrationCategoryId): string {
  return INTEGRATION_CATEGORIES.find((category) => category.id === id)?.label ?? id;
}

/** El distintivo de una integración (iniciales con el color del tema; sin logos de marca). */
export type IntegrationMarkKind = AiProviderId | "meta" | "webhook" | "mcp";

export interface IntegrationDefinition {
  /** Único en el catálogo; también es su dirección: `/integrations/<id>`. */
  readonly id: string;
  readonly category: IntegrationCategoryId;
  readonly name: string;
  /** Una línea: para qué sirve. */
  readonly tagline: string;
  readonly mark: IntegrationMarkKind;
  /** Cómo se cuentan: «conexión» / «conexiones», «webhook» / «webhooks». */
  readonly unit: { readonly one: string; readonly many: string };
  /** Palabras extra para el buscador. */
  readonly keywords?: ReadonlyArray<string>;
}

/** Una integración con cuántas hay conectadas o creadas en la cuenta. */
export interface IntegrationEntry extends IntegrationDefinition {
  readonly connected: number;
}

/** Lo que aporta cada fuente: su estado y cuántas hay de cada integración (por id). */
export interface IntegrationSourceState {
  readonly status: ConnectionListStatus;
  readonly counts: Readonly<Record<string, number>>;
  readonly refresh: () => Promise<unknown>;
}

/** Definiciones + conteos de todas las fuentes. Sin conteo (fuente cargando o caída): 0. */
export function buildEntries(definitions: ReadonlyArray<IntegrationDefinition>, sources: ReadonlyArray<Pick<IntegrationSourceState, "counts">>): IntegrationEntry[] {
  const counts: Record<string, number> = {};
  for (const source of sources) Object.assign(counts, source.counts);
  return definitions.map((definition) => ({ ...definition, connected: counts[definition.id] ?? 0 }));
}

export type CategoryFilter = IntegrationCategoryId | "all";

const normalize = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/** Las entradas de una categoría que coinciden con la búsqueda (nombre, descripción, categoría o palabras clave). */
export function filterEntries(entries: ReadonlyArray<IntegrationEntry>, category: CategoryFilter, query: string): IntegrationEntry[] {
  const q = normalize(query.trim());
  return entries.filter((entry) => {
    if (category !== "all" && entry.category !== category) return false;
    if (!q) return true;
    const haystack = [entry.name, entry.tagline, categoryLabel(entry.category), ...(entry.keywords ?? [])].map(normalize).join(" ");
    return haystack.includes(q);
  });
}

/** Activas (con algo conectado) primero; dentro de cada grupo, por nombre. */
export function splitByActivity(entries: ReadonlyArray<IntegrationEntry>): { readonly active: IntegrationEntry[]; readonly available: IntegrationEntry[] } {
  const byName = (a: IntegrationEntry, b: IntegrationEntry) => a.name.localeCompare(b.name, "es");
  return {
    active: entries.filter((entry) => entry.connected > 0).sort(byName),
    available: entries.filter((entry) => entry.connected === 0).sort(byName)
  };
}

/** «2 conexiones», «1 webhook». */
export function connectedLabel(entry: IntegrationEntry): string {
  return `${entry.connected} ${entry.connected === 1 ? entry.unit.one : entry.unit.many}`;
}

/**
 * Estado combinado de varias fuentes: cargando mientras alguna carga; error
 * solo si fallaron TODAS (si una falla, sus tarjetas se ven sin conteo y su
 * página explica el problema: el centro no se cae por una integración).
 */
export function combineStatus(states: ReadonlyArray<ConnectionListStatus>): ConnectionListStatus {
  if (states.some((state) => state === "loading")) return "loading";
  if (states.length > 0 && states.every((state) => state === "error")) return "error";
  return "ready";
}
