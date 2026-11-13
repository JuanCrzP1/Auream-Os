import type { FieldOrigin } from "@contracts/ContactFieldValueContracts";

// ---------------------------------------------------------------------------
// De dónde salió un dato de la ficha, en una frase: «Lo respondió en "¿En qué
// ciudad estás?" · 12 nov», «Lo cambió Ana · hoy». Puro: lo prueban sin pantalla.
// ---------------------------------------------------------------------------

const VERB: Readonly<Record<string, string>> = {
  question: "Lo respondió en",
  menu: "Lo eligió en",
  integration: "Lo trajo",
  ai: "Lo sacó la IA en"
};

/** «hoy», «ayer», «12 de nov» o «12 de nov de 2025». */
export function whenText(at: string, now: Date = new Date()): string {
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) return "";
  const day = (value: Date) => new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
  const diff = Math.round((day(now) - day(date)) / 86_400_000);
  if (diff === 0) return "hoy";
  if (diff === 1) return "ayer";
  const short = date.toLocaleDateString("es-CO", { day: "numeric", month: "short", ...(date.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}) });
  return short.replace(".", "");
}

export function originText(origin: FieldOrigin, now: Date = new Date()): string {
  const when = whenText(origin.at, now);
  const tail = when ? ` · ${when}` : "";
  if (origin.source === "team") return `Lo cambió ${origin.actorName ?? "alguien del equipo"}${tail}`;
  if (origin.blockName) return `${VERB[origin.blockType ?? ""] ?? "Lo guardó"} «${origin.blockName}»${origin.flowName ? ` del flujo «${origin.flowName}»` : ""}${tail}`;
  if (origin.flowName) return `Lo guardó el flujo «${origin.flowName}»${tail}`;
  return `Lo guardó un flujo${tail}`;
}
