// ---------------------------------------------------------------------------
// Conversión de valores entre PostgreSQL y el dominio. Compartido por los
// repositorios SQL de automatizaciones.
// ---------------------------------------------------------------------------

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * `true` si el valor puede ir a una columna `uuid`. Un id con otra forma no
 * existe en la base: los repositorios lo tratan como «no encontrado» en lugar
 * de dejar que PostgreSQL lance un error de sintaxis (un 500 desde fuera).
 */
export function isUuid(value: string): boolean {
  return UUID.test(value);
}

/** `timestamptz` llega como `Date` desde el driver; el dominio usa ISO 8601. */
export function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
