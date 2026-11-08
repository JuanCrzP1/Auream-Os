import type { Option } from "./fields";
import { BUILT_IN_VARIABLES } from "@contracts/TemplateVariables";

// ---------------------------------------------------------------------------
// Catálogos compartidos por los editores. Auream se vende en varios países:
// todo lo que dependa del país (prefijo, moneda, documento) sale de aquí.
// ---------------------------------------------------------------------------

export interface Country {
  /** ISO 3166-1 alfa-2. */
  readonly code: string;
  readonly name: string;
  readonly flag: string;
  /** Prefijo telefónico sin «+». */
  readonly dial: string;
  /** Moneda local (ISO 4217). */
  readonly currency: string;
  /** Cómo se llama el documento fiscal o de identidad. */
  readonly taxIdLabel: string;
}

export const COUNTRIES: ReadonlyArray<Country> = [
  { code: "CO", name: "Colombia", flag: "🇨🇴", dial: "57", currency: "COP", taxIdLabel: "NIT o cédula" },
  { code: "MX", name: "México", flag: "🇲🇽", dial: "52", currency: "MXN", taxIdLabel: "RFC" },
  { code: "PE", name: "Perú", flag: "🇵🇪", dial: "51", currency: "PEN", taxIdLabel: "RUC o DNI" },
  { code: "CL", name: "Chile", flag: "🇨🇱", dial: "56", currency: "CLP", taxIdLabel: "RUT" },
  { code: "AR", name: "Argentina", flag: "🇦🇷", dial: "54", currency: "ARS", taxIdLabel: "CUIT o CUIL" },
  { code: "EC", name: "Ecuador", flag: "🇪🇨", dial: "593", currency: "USD", taxIdLabel: "RUC o cédula" },
  { code: "VE", name: "Venezuela", flag: "🇻🇪", dial: "58", currency: "VES", taxIdLabel: "RIF o cédula" },
  { code: "BR", name: "Brasil", flag: "🇧🇷", dial: "55", currency: "BRL", taxIdLabel: "CPF o CNPJ" },
  { code: "PA", name: "Panamá", flag: "🇵🇦", dial: "507", currency: "USD", taxIdLabel: "RUC o cédula" },
  { code: "CR", name: "Costa Rica", flag: "🇨🇷", dial: "506", currency: "CRC", taxIdLabel: "Cédula física o jurídica" },
  { code: "GT", name: "Guatemala", flag: "🇬🇹", dial: "502", currency: "GTQ", taxIdLabel: "NIT o DPI" },
  { code: "DO", name: "República Dominicana", flag: "🇩🇴", dial: "1", currency: "DOP", taxIdLabel: "RNC o cédula" },
  { code: "BO", name: "Bolivia", flag: "🇧🇴", dial: "591", currency: "BOB", taxIdLabel: "NIT o CI" },
  { code: "PY", name: "Paraguay", flag: "🇵🇾", dial: "595", currency: "PYG", taxIdLabel: "RUC o CI" },
  { code: "UY", name: "Uruguay", flag: "🇺🇾", dial: "598", currency: "UYU", taxIdLabel: "RUT o CI" },
  { code: "US", name: "Estados Unidos", flag: "🇺🇸", dial: "1", currency: "USD", taxIdLabel: "EIN o SSN" },
  { code: "ES", name: "España", flag: "🇪🇸", dial: "34", currency: "EUR", taxIdLabel: "NIF o CIF" }
];

export const COUNTRY_CODES_ISO = COUNTRIES.map((country) => country.code);

export const DEFAULT_COUNTRY = "CO";

export function findCountry(code: string): Country {
  return COUNTRIES.find((country) => country.code === code) ?? COUNTRIES[0];
}

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

const CURRENCY_NAMES: Readonly<Record<string, string>> = {
  COP: "Peso colombiano",
  MXN: "Peso mexicano",
  PEN: "Sol peruano",
  CLP: "Peso chileno",
  ARS: "Peso argentino",
  USD: "Dólar estadounidense",
  VES: "Bolívar",
  BRL: "Real brasileño",
  CRC: "Colón costarricense",
  GTQ: "Quetzal",
  DOP: "Peso dominicano",
  BOB: "Boliviano",
  PYG: "Guaraní",
  UYU: "Peso uruguayo",
  EUR: "Euro"
};

/** Monedas ofrecidas en los editores (ISO 4217). */
export const CURRENCIES: ReadonlyArray<Option<string>> = Object.entries(CURRENCY_NAMES).map(([code, name]) => ({
  value: code,
  label: `${code} · ${name}`
}));

export const CURRENCY_CODES = CURRENCIES.map((currency) => currency.value);

/** Variables del sistema en plantillas. Fuente única: `contracts/TemplateVariables.ts`. */
export const CONTACT_VARIABLES: ReadonlyArray<string> = BUILT_IN_VARIABLES.map((variable) => `{${variable.name}}`);

/** Valores de ejemplo para mostrar variables en vistas previas. */
const SAMPLE_VALUES: Readonly<Record<string, string>> = {
  "{first_name}": "Laura",
  "{full_name}": "Laura Gómez",
  "{phone}": "+57 300 123 4567",
  "{email}": "laura@correo.com",
  "{last_message}": "Quiero más información"
};

/** Sustituye las variables conocidas por valores de ejemplo; deja el resto tal cual. */
export function withSampleValues(text: string): string {
  return text.replace(/\{[a-z_]+\}/g, (variable) => SAMPLE_VALUES[variable] ?? variable);
}
