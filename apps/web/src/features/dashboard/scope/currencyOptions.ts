import { COUNTRIES, CURRENCY_CODES, CURRENCY_NAMES } from "@contracts/Countries";

// ---------------------------------------------------------------------------
// Las monedas en que se puede ver el Dashboard: código, nombre y la bandera de
// su país (las mismas banderas que el selector de país del teléfono). El dólar
// y el euro llevan la de Estados Unidos y la de la Unión Europea.
// ---------------------------------------------------------------------------

export interface CurrencyOption {
  readonly code: string;
  readonly name: string;
  readonly flag: string;
}

const FLAGS: Readonly<Record<string, string>> = { USD: "🇺🇸", EUR: "🇪🇺" };
/** Nombres más claros donde el de la lista es ambiguo. */
const NAMES: Readonly<Record<string, string>> = { VES: "Bolívar venezolano" };

export const CURRENCY_OPTIONS: ReadonlyArray<CurrencyOption> = CURRENCY_CODES.map((code) => ({
  code,
  name: NAMES[code] ?? CURRENCY_NAMES[code] ?? code,
  flag: FLAGS[code] ?? COUNTRIES.find((country) => country.currency === code)?.flag ?? "🌐"
}));

export function currencyOption(code: string): CurrencyOption {
  return CURRENCY_OPTIONS.find((option) => option.code === code) ?? { code, name: code, flag: "🌐" };
}

/** Las monedas que coinciden con lo que se busca (código, nombre o país). */
export function searchCurrencies(query: string): ReadonlyArray<CurrencyOption> {
  const text = query.trim().toLowerCase();
  if (!text) return CURRENCY_OPTIONS;
  return CURRENCY_OPTIONS.filter((option) => {
    const countries = COUNTRIES.filter((country) => country.currency === option.code).map((country) => country.name.toLowerCase());
    return option.code.toLowerCase().includes(text) || option.name.toLowerCase().includes(text) || countries.some((name) => name.includes(text));
  });
}
