// ---------------------------------------------------------------------------
// Zonas horarias para Empresa: primero las de los países donde opera Auream,
// después todas las demás que conoce el navegador. Cada una con su diferencia
// con UTC de hoy («Bogotá · GMT-5»).
// ---------------------------------------------------------------------------

/** Las de los países de Auream, en el orden en que más se usan, con su nombre en español. */
const COMMON_LABELS: Readonly<Record<string, string>> = {
  "America/Bogota": "Bogotá, Colombia",
  "America/Mexico_City": "Ciudad de México, México",
  "America/Lima": "Lima, Perú",
  "America/Guayaquil": "Quito y Guayaquil, Ecuador",
  "America/Caracas": "Caracas, Venezuela",
  "America/Santiago": "Santiago, Chile",
  "America/Argentina/Buenos_Aires": "Buenos Aires, Argentina",
  "America/La_Paz": "La Paz, Bolivia",
  "America/Asuncion": "Asunción, Paraguay",
  "America/Montevideo": "Montevideo, Uruguay",
  "America/Panama": "Panamá",
  "America/Costa_Rica": "San José, Costa Rica",
  "America/Guatemala": "Guatemala",
  "America/El_Salvador": "San Salvador, El Salvador",
  "America/Tegucigalpa": "Tegucigalpa, Honduras",
  "America/Managua": "Managua, Nicaragua",
  "America/Santo_Domingo": "Santo Domingo, República Dominicana",
  "America/Puerto_Rico": "San Juan, Puerto Rico",
  "America/New_York": "Nueva York, Estados Unidos",
  "America/Chicago": "Chicago, Estados Unidos",
  "America/Los_Angeles": "Los Ángeles, Estados Unidos",
  "Europe/Madrid": "Madrid, España"
};

export const COMMON_TIMEZONES: ReadonlyArray<string> = Object.keys(COMMON_LABELS);

function allTimezones(): ReadonlyArray<string> {
  const supported = (Intl as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf?.("timeZone") ?? [];
  return supported.filter((zone) => !COMMON_TIMEZONES.includes(zone));
}

/** «America/Bogota» → «Bogotá, Colombia»; las demás, su ciudad («America/Argentina/Cordoba» → «Cordoba»). */
export function cityOf(zone: string): string {
  return COMMON_LABELS[zone] ?? (zone.split("/").pop() ?? zone).replace(/_/g, " ");
}

/** Diferencia con UTC en este momento: «GMT-5», «GMT+1». */
export function offsetOf(zone: string, at: Date = new Date()): string {
  try {
    const part = new Intl.DateTimeFormat("en-US", { timeZone: zone, timeZoneName: "shortOffset" }).formatToParts(at).find((p) => p.type === "timeZoneName");
    return part?.value ?? "";
  } catch {
    return "";
  }
}

/** La hora en esa zona, como la vería el equipo: «10:35 p. m.». */
export function timeIn(zone: string, at: Date = new Date()): string {
  try {
    // Espacios que no parten la hora en dos renglones («10:47 p.» / «m.»).
    return at.toLocaleTimeString("es-CO", { timeZone: zone, hour: "numeric", minute: "2-digit" }).replace(/\s/g, " ");
  } catch {
    return "";
  }
}

export interface TimezoneOption {
  readonly value: string;
  readonly label: string;
}

/** Las opciones del selector: las comunes y luego el resto (incluye la actual aunque sea rara). */
export function timezoneOptions(current: string): { readonly common: ReadonlyArray<TimezoneOption>; readonly others: ReadonlyArray<TimezoneOption> } {
  const toOption = (zone: string) => ({ value: zone, label: `${cityOf(zone)} · ${offsetOf(zone)}` });
  const others = allTimezones();
  const extra = current && !COMMON_TIMEZONES.includes(current) && !others.includes(current) ? [current] : [];
  return { common: COMMON_TIMEZONES.map(toOption), others: [...extra, ...others].map(toOption) };
}
