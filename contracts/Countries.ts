// ---------------------------------------------------------------------------
// Países y monedas en que opera Auream (multipaís). Fuente única para el
// builder (selectores, prefijos, documento fiscal) y para el motor (moneda por
// defecto, lectura de comprobantes).
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

export const CURRENCY_NAMES: Readonly<Record<string, string>> = {
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

/** Monedas ofrecidas (ISO 4217). */
export const CURRENCY_CODES: ReadonlyArray<string> = Object.keys(CURRENCY_NAMES);

/** Áreas de República Dominicana dentro del +1 (el resto del +1, Estados Unidos). */
const DOMINICAN_AREAS = ["809", "829", "849"];

/**
 * El país de un teléfono internacional («573001234567» → `CO`) por su prefijo
 * más largo. `null` si no es de ninguno de los países de la lista.
 */
export function countryOfPhone(phone: string | null | undefined): string | null {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (digits.length < 8) return null;
  if (digits.startsWith("1")) return DOMINICAN_AREAS.some((area) => digits.startsWith(`1${area}`)) ? "DO" : "US";
  const match = [...COUNTRIES]
    .filter((country) => country.dial !== "1" && digits.startsWith(country.dial))
    .sort((a, b) => b.dial.length - a.dial.length)[0];
  return match?.code ?? null;
}
