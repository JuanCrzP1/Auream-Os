import { ValidationError } from "../../../platform/observability/errors/ValidationError";

// ---------------------------------------------------------------------------
// La empresa (la cuenta, `tenants`) tal como la configura su dueño: el nombre
// que ve el equipo, su logo y su zona horaria. La zona la usan el Programador,
// los horarios y las fechas de los flujos; si no eligió una, rige la de la
// plataforma (`DEFAULT_TENANT_TIMEZONE`).
// ---------------------------------------------------------------------------

export interface Company {
  readonly tenantId: string;
  readonly name: string;
  /** Nula: usa la zona horaria de la plataforma. */
  readonly timezone: string | null;
  readonly logoPathname: string | null;
  readonly logoUrl: string | null;
}

export interface CompanyChanges {
  readonly name?: string;
  readonly timezone?: string | null;
  readonly logo?: { readonly pathname: string; readonly url: string } | null;
}

export const COMPANY_NAME_MAX = 80;

/** «  Dilo   Cantando » → «Dilo Cantando». Entre 1 y 80 caracteres. */
export function normalizeCompanyName(value: unknown): string {
  const name = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  if (!name) throw new ValidationError("Escribe el nombre de la empresa.");
  if (name.length > COMPANY_NAME_MAX) throw new ValidationError(`El nombre puede tener hasta ${COMPANY_NAME_MAX} caracteres.`);
  return name;
}

/** Zona horaria IANA que el motor sabe usar (`America/Bogota`, `Europe/Madrid`…). */
export function isValidTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(0);
    return value.includes("/") || value === "UTC";
  } catch {
    return false;
  }
}

/** Nulo o vacío: volver a la de la plataforma. */
export function normalizeTimeZone(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || !isValidTimeZone(value.trim())) throw new ValidationError("Elige una zona horaria de la lista.");
  return value.trim();
}

/** La carpeta de la marca de una cuenta en el almacén (dentro de la carpeta de la cuenta). */
export function companyLogoFolder(tenantId: string): string {
  return `tenants/${tenantId}/brand/`;
}
