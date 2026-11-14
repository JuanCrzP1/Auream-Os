import type { BusinessDataUse, BusinessDataType } from "@contracts/BusinessDataContracts";
import { BUILT_IN_VARIABLES } from "@contracts/TemplateVariables";
import type { ContactFieldValue } from "@contracts/ContactContracts";
import { fieldValueText } from "@contracts/FieldValues";

// ---------------------------------------------------------------------------
// Cómo se dicen las cosas en Datos del negocio: dónde se usa cada dato, qué
// ayuda va con cada tipo y cómo se arma «Así lo ve tu cliente» (el mensaje
// real con el dato resaltado y lo demás con valores de ejemplo). Puro.
// ---------------------------------------------------------------------------

export const TYPE_HINT: Readonly<Record<BusinessDataType, string>> = {
  text: "Una cuenta, un horario, una dirección, un enlace: lo que quieras escribir una sola vez.",
  number: "Una cantidad que usas en mensajes o condiciones: cupos, días de entrega.",
  date: "Una fecha: la del próximo evento o el cierre de inscripciones.",
  boolean: "Un interruptor para tus condiciones: «¿promo activa?», «¿atendemos hoy?»."
};

export const PLACEHOLDER: Readonly<Record<BusinessDataType, string>> = {
  text: "Lunes a sábado, 8 a. m. a 6 p. m.",
  number: "12",
  date: "24/12/2026",
  boolean: ""
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** «3 mensajes · 1 difusión · 1 respuesta», o «Nadie lo usa». */
export function usesSummary(uses: ReadonlyArray<BusinessDataUse>): { readonly text: string; readonly idle: boolean } {
  const flows = uses.filter((use) => use.kind === "flow").length;
  const broadcasts = uses.filter((use) => use.kind === "broadcast").length;
  const replies = uses.filter((use) => use.kind === "quickReply").length;
  const parts = [
    flows ? plural(flows, "bloque", "bloques") : "",
    broadcasts ? plural(broadcasts, "difusión", "difusiones") : "",
    replies ? plural(replies, "respuesta rápida", "respuestas rápidas") : ""
  ].filter(Boolean);
  return parts.length ? { text: parts.join(" · "), idle: false } : { text: "Nadie lo usa todavía", idle: true };
}

const SAMPLES = Object.fromEntries(BUILT_IN_VARIABLES.map((variable) => [variable.name, variable.sample]));

/** Un trozo del mensaje: texto normal o el valor de un dato del negocio (`key`). */
export interface PreviewPiece {
  readonly text: string;
  readonly key?: string;
}

const VARIABLE = /\{([A-Za-z_][A-Za-z0-9_.-]{0,63})(?:\|([^{}\r\n]{0,100}))?\}/g;

/**
 * El mensaje como le llega al cliente: los datos del negocio con su valor real
 * (marcados para resaltarlos), `{first_name}` y compañía con un ejemplo, y lo
 * que no se sabe aquí (un campo del cliente) con su valor por defecto o tal cual.
 */
export function previewPieces(template: string, values: Readonly<Record<string, ContactFieldValue>>): PreviewPiece[] {
  const pieces: PreviewPiece[] = [];
  let at = 0;
  for (const match of template.matchAll(VARIABLE)) {
    const [whole, name, fallback] = match;
    if (match.index! > at) pieces.push({ text: template.slice(at, match.index) });
    if (name!.startsWith("g_")) {
      const value = values[name!];
      pieces.push({ text: value === undefined || value === "" ? (fallback?.trim() ?? "") : fieldValueText(value), key: name! });
    } else {
      pieces.push({ text: SAMPLES[name!] ?? fallback?.trim() ?? whole! });
    }
    at = match.index! + whole!.length;
  }
  if (at < template.length) pieces.push({ text: template.slice(at) });
  return pieces;
}
