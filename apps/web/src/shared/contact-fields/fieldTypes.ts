import { CONTACT_FIELD_TYPE_LABEL, type ContactFieldType } from "@contracts/ContactFieldContracts";
import { foldAnswer } from "@contracts/FieldValues";

// ---------------------------------------------------------------------------
// Los tipos de un campo del cliente y las opciones de una lista, como se ven
// en pantalla (Configuración, editor de flujos, ficha). Puro.
// ---------------------------------------------------------------------------

export const TYPE_HINT: Readonly<Record<ContactFieldType, string>> = {
  text: "Cualquier respuesta escrita: un nombre, una nota, una dirección.",
  number: "Para cantidades: presupuesto, edad, unidades. Acepta 1.200 o 1,200.",
  date: "Una fecha: cumpleaños, último pago. Acepta 13/11/2026 o 2026-11-13.",
  boolean: "Sí o no: «¿ya compró?», «¿acepta promociones?».",
  list: "El cliente elige entre opciones fijas: siempre escrito igual, listo para tus condiciones."
};

/** Todos los tipos en orden, con su nombre. */
export const TYPE_CHOICES = (Object.keys(CONTACT_FIELD_TYPE_LABEL) as ContactFieldType[]).map((type) => ({ type, label: CONTACT_FIELD_TYPE_LABEL[type] }));

/** «Lista · 4» para una lista; el nombre del tipo para lo demás. */
export function typeLabel(type: ContactFieldType, options: ReadonlyArray<string> = []): string {
  return type === "list" && options.length > 0 ? `${CONTACT_FIELD_TYPE_LABEL.list} · ${options.length}` : CONTACT_FIELD_TYPE_LABEL[type];
}

/** Las opciones con una nueva al final, sin repetir (sin tildes, mayúsculas ni signos: la misma regla del servidor). `null` si ya está o viene vacía. */
export function withOption(options: ReadonlyArray<string>, raw: string): string[] | null {
  const option = raw.replace(/\s+/g, " ").trim();
  if (!option || options.some((current) => foldAnswer(current) === foldAnswer(option))) return null;
  return [...options, option];
}
