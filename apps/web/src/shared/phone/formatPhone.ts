import { COUNTRIES, type Country } from "@contracts/Countries";

// ---------------------------------------------------------------------------
// Un número guardado en dígitos (`573013815302`) mostrado como se lee:
// «+57 301 381 5302», con la bandera de su país.
// ---------------------------------------------------------------------------

/** Indicativos de más largo a más corto: «593» (Ecuador) antes que «59…». */
const BY_DIAL = [...COUNTRIES].sort((a, b) => b.dial.length - a.dial.length);

export function countryOfPhone(digits: string): Country | null {
  return BY_DIAL.find((country) => digits.startsWith(country.dial)) ?? null;
}

/**
 * Bloques de 3 contados desde el final y 4 al cierre: «301 381 5302»,
 * «1 551 234 5678». El bloque corto queda al principio, nunca en medio.
 */
function group(national: string): string {
  if (national.length <= 4) return national;
  const tail = national.slice(-4);
  const head: string[] = [];
  for (let end = national.length - 4; end > 0; end -= 3) head.unshift(national.slice(Math.max(0, end - 3), end));
  return [...head, tail].join(" ");
}

export interface FormattedPhone {
  readonly text: string;
  readonly flag: string | null;
}

export function formatPhone(digits: string): FormattedPhone {
  const clean = digits.replace(/\D/g, "");
  const country = countryOfPhone(clean);
  if (!country) return { text: `+${group(clean)}`, flag: null };
  return { text: `+${country.dial} ${group(clean.slice(country.dial.length))}`, flag: country.flag };
}
