import { COUNTRIES } from "@contracts/Countries";

/** Prefijo por defecto mientras la persona no elige otro. */
export const DEFAULT_DIAL = "57";

/**
 * «+573001234567» → { dial: "57", number: "3001234567" }, con el prefijo más
 * largo que coincida entre los países de Auream. Sin número: el prefijo por
 * defecto y el número vacío.
 */
export function splitPhone(phone: string | null): { readonly dial: string; readonly number: string } {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (!digits) return { dial: DEFAULT_DIAL, number: "" };
  const match = [...COUNTRIES].sort((a, b) => b.dial.length - a.dial.length).find((country) => digits.startsWith(country.dial));
  return match ? { dial: match.dial, number: digits.slice(match.dial.length) } : { dial: DEFAULT_DIAL, number: digits };
}

/** Prefijo y número → formato internacional; sin número, `null` (lo borra). */
export function joinPhone(dial: string, number: string): string | null {
  const digits = number.replace(/\D/g, "");
  return digits ? `+${dial}${digits}` : null;
}
