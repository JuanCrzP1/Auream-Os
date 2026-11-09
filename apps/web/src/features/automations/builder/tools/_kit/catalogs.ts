import type { Option } from "./fields";
import { BUILT_IN_VARIABLES } from "@contracts/TemplateVariables";
import { COUNTRIES, CURRENCY_CODES, CURRENCY_NAMES } from "@contracts/Countries";

// Datos de países y monedas: `contracts/Countries.ts` (los comparte el motor).
export { COUNTRIES, COUNTRY_CODES_ISO, DEFAULT_COUNTRY, findCountry, type Country } from "@contracts/Countries";

// ---------------------------------------------------------------------------
// Catálogos compartidos por los editores. Auream se vende en varios países:
// todo lo que dependa del país (prefijo, moneda, documento) sale de aquí.
// ---------------------------------------------------------------------------

export const COUNTRY_OPTIONS: ReadonlyArray<Option<string>> = COUNTRIES.map((country) => ({
  value: country.code,
  label: `${country.flag} ${country.name}`
}));

/** Prefijos telefónicos (sin repetir: República Dominicana y EE. UU. comparten +1). */
export const COUNTRY_CODES: ReadonlyArray<Option<string>> = COUNTRIES.filter(
  (country, index) => COUNTRIES.findIndex((other) => other.dial === country.dial) === index
).map((country) => ({
  value: country.dial,
  label: country.dial === "1" ? "🇺🇸 🇩🇴 +1" : `${country.flag} +${country.dial}`
}));

export const COUNTRY_CODE_VALUES = COUNTRY_CODES.map((code) => code.value);

/** Monedas ofrecidas en los editores (ISO 4217). */
export const CURRENCIES: ReadonlyArray<Option<string>> = Object.entries(CURRENCY_NAMES).map(([code, name]) => ({
  value: code,
  label: `${code} · ${name}`
}));

export { CURRENCY_CODES };

/** Variables del sistema en plantillas. Fuente única: `contracts/TemplateVariables.ts`. */
export const CONTACT_VARIABLES: ReadonlyArray<string> = BUILT_IN_VARIABLES.map((variable) => `{${variable.name}}`);

/** Valores de ejemplo para mostrar variables en vistas previas. */
const SAMPLE_VALUES: Readonly<Record<string, string>> = {
  "{first_name}": "Laura",
  "{full_name}": "Laura Gómez",
  "{phone}": "+57 300 123 4567",
  "{email}": "laura@correo.com",
  "{last_message}": "Quiero más información",
  "{fecha}": "09/11/2026",
  "{hora}": "14:35"
};

/** Sustituye las variables conocidas por valores de ejemplo; deja el resto tal cual. */
export function withSampleValues(text: string): string {
  return text.replace(/\{[a-z_]+\}/g, (variable) => SAMPLE_VALUES[variable] ?? variable);
}
