// ---------------------------------------------------------------------------
// Valores con tipo de los campos del cliente — UNA sola forma de leerlos y de
// mostrarlos, para el servidor (guardar en la ficha), el motor (condiciones y
// mensajes) y la web (la ficha).
//
// En la ficha se guardan «a lo computador»: sí o no como `true`/`false`, las
// fechas como `1990-11-13`, los números como número. A una persona se le
// muestran como persona: «Sí», «13/11/1990». Y al comparar, «Sí» es `true` y
// «13/11/1990» es `1990-11-13`. Puro: sin red ni base.
// ---------------------------------------------------------------------------

/** Sin tildes, sin mayúsculas, sin espacios de más. */
const fold = (value: string) => value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();

/** Además sin signos: «¡Medellín!» y «medellin.» son lo mismo. */
export function foldAnswer(value: string): string {
  return fold(value).replace(/[^\p{L}\p{N} ]+/gu, "").replace(/\s+/g, " ").trim();
}

const YES = new Set(["si", "yes", "true", "1", "verdadero", "s"]);
const NO = new Set(["no", "false", "0", "falso", "n"]);

/** «Sí», «si.», «yes», «1» → `true`; «No», «falso» → `false`; lo demás (también «no sé») → `undefined`. */
export function parseYesNo(raw: unknown): boolean | undefined {
  if (typeof raw === "boolean") return raw;
  if (typeof raw !== "string" && typeof raw !== "number") return undefined;
  const answer = foldAnswer(String(raw));
  return YES.has(answer) ? true : NO.has(answer) ? false : undefined;
}

/**
 * Un número escrito como lo escribe la gente: «1.200.000», «1,200.50»,
 * «1.200,50», «$ 49.900», «12,5». `undefined` si no hay número.
 */
export function parseFieldNumber(raw: unknown): number | undefined {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : undefined;
  if (typeof raw !== "string") return undefined;
  let text = raw.replace(/[^\d.,-]/g, "");
  if (!/\d/.test(text)) return undefined;
  const lastDot = text.lastIndexOf(".");
  const lastComma = text.lastIndexOf(",");
  if (lastDot >= 0 && lastComma >= 0) {
    text = lastComma > lastDot ? text.replace(/\./g, "").replace(",", ".") : text.replace(/,/g, "");
  } else if (lastComma >= 0) {
    text = /,\d{1,2}$/.test(text) && text.split(",").length === 2 ? text.replace(",", ".") : text.replace(/,/g, "");
  } else if (/^-?\d{1,3}(\.\d{3})+$/.test(text)) {
    text = text.replace(/\./g, "");
  }
  const value = Number(text);
  return Number.isFinite(value) ? value : undefined;
}

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Año de dos cifras: hasta 50 es 20xx, desde 51 es 19xx («90» → 1990, un cumpleaños; «26» → 2026). */
const fullYear = (year: string) => (year.length === 2 ? (Number(year) <= 50 ? 2000 : 1900) + Number(year) : Number(year));

/** Una fecha «2026-11-13», «13/11/2026», «13-11-90» → `2026-11-13`, `1990-11-13`. `undefined` si no es una fecha que exista. */
export function parseFieldDate(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const text = raw.trim();
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(text);
  const local = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/.exec(text);
  const parts = iso ? [Number(iso[1]), Number(iso[2]), Number(iso[3])] : local ? [fullYear(local[3]!), Number(local[2]), Number(local[1])] : null;
  if (!parts) return undefined;
  const [year, month, day] = parts as [number, number, number];
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return undefined;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Un valor de la ficha como lo lee una persona: `true` → «Sí», `false` →
 * «No», `1990-11-13` → «13/11/1990». Lo demás, tal cual.
 */
export function fieldValueText(value: string | number | boolean): string {
  if (typeof value === "boolean") return value ? "Sí" : "No";
  if (typeof value === "string") {
    const day = ISO_DAY.exec(value);
    if (day) return `${day[3]}/${day[2]}/${day[1]}`;
  }
  return String(value);
}

/**
 * ¿Es lo mismo? Con tipo: «Sí» = `true`, «1.200.000» = `1200000`,
 * «13/11/1990» = `1990-11-13`. `undefined` si no se pueden comparar con tipo
 * (entonces se comparan como texto).
 */
export function sameTypedValue(actual: unknown, expected: string): boolean | undefined {
  if (typeof actual === "boolean") {
    const answer = parseYesNo(expected);
    return answer === undefined ? undefined : answer === actual;
  }
  if (typeof actual === "number") {
    const number = parseFieldNumber(expected);
    return number === undefined ? undefined : number === actual;
  }
  const a = parseFieldDate(actual);
  const b = a === undefined ? undefined : parseFieldDate(expected);
  return a !== undefined && b !== undefined ? a === b : undefined;
}
