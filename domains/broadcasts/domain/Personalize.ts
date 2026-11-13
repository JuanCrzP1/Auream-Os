import { isBusinessKey } from "../../../contracts/BusinessDataContracts";
import { renderTemplate } from "../../../contracts/TemplateVariables";

// ---------------------------------------------------------------------------
// El texto de cada persona: `{first_name}` con su nombre (o nada, sin dejar un
// hueco: «Hola 👋»), los Datos del negocio (`{g_horario}`) y el pie para darse
// de baja. Y lo contrario: reconocer cuando alguien pide no recibir más.
// ---------------------------------------------------------------------------

export const OPT_OUT_FOOTER = "Para no recibir más mensajes, responde SALIR.";

export interface Person {
  readonly name: string | null;
  readonly phone: string;
}

/** Los Datos del negocio de la cuenta, con su tipo. */
export type BusinessValues = Readonly<Record<string, string | number | boolean>>;

export function personalize(text: string, person: Person, footer: boolean, business: BusinessValues = {}): string {
  const full = (person.name ?? "").trim();
  const first = full.split(/\s+/)[0] ?? "";
  const values: Record<string, string> = { first_name: first, nombre: first, full_name: full, phone: person.phone };
  const rendered = renderTemplate(text, (name) => (isBusinessKey(name) ? business[name] : values[name])).text
    .replace(/[ \t]{2,}/g, " ")
    .replace(/ +([,.!?;:])/g, "$1")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
  return footer && rendered ? `${rendered}\n\n_${OPT_OUT_FOOTER}_` : rendered;
}

const normalize = (text: string) =>
  text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Una palabra sola que pide salir. */
const ALONE = new Set(["salir", "stop", "baja", "basta", "cancelar", "desuscribir", "unsubscribe"]);
/** Frases que piden no recibir más, aunque vengan con más texto. */
const PHRASES = ["no quiero mas", "no me escriban", "no me envien mas", "no me manden mas", "dejen de escribir", "no mas mensajes", "no me interesa recibir", "darme de baja", "eliminar de la lista", "sacame de la lista", "sacarme de la lista"];

/** ¿El mensaje pide no recibir más difusiones? */
export function isOptOut(text: string): boolean {
  const clean = normalize(text);
  if (!clean || clean.length > 160) return false;
  return ALONE.has(clean) || PHRASES.some((phrase) => clean.includes(phrase));
}
