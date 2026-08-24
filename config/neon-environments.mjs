// ---------------------------------------------------------------------------
// neon-environments
//
// Responsabilidad única: identificar el host de cómputo de cada rama de Neon
// y decidir si una connection string apunta a producción.
//
// Es la fuente ÚNICA de estos valores. Es .mjs y no .ts a propósito: los
// scripts de operaciones (scripts/db/*.mjs) se ejecutan con `node` directo,
// sin paso de build, y deben poder importarlo sin depender de `dist/`. El
// código TypeScript lo importa igual (ver neon-environments.d.mts, que sólo
// añade tipos — no redeclara ningún valor).
//
// Proyecto Neon: bots-ai-platform (dark-lab-69510863)
// ---------------------------------------------------------------------------

export const NEON_PRODUCTION_COMPUTE_HOST = "ep-lingering-shape-ax1uhzqd";
export const NEON_TEST_COMPUTE_HOST = "ep-rapid-lake-ax18xfqc";

/**
 * Host real de la connection string, o null si no es una URL legible.
 *
 * Es la única función que intenta parsear — `isProductionDatabaseUrl` y
 * `safeHostOf` se apoyan en ella para no duplicar el parseo ni su manejo de
 * error.
 */
export function parseDatabaseHost(connectionString) {
  try {
    return new URL(connectionString.replace(/^postgres(ql)?:\/\//, "https://")).hostname;
  } catch {
    return null;
  }
}

/**
 * ¿Esta connection string apunta al endpoint de producción?
 *
 * Compara por HOST real, no por el nombre de la variable de entorno de la que
 * salió: así una `TEST_DATABASE_URL` mal configurada que apunte a producción
 * se detecta igual.
 *
 * Una URL ilegible NO es "producción": es un destino inválido, un caso
 * semánticamente distinto. Devuelve `false` aquí — quien llama debe rechazar
 * la URL inválida ANTES de preguntar esto (ver `parseDatabaseHost`), para que
 * el motivo de aborto sea el correcto en cada caso.
 */
export function isProductionDatabaseUrl(connectionString) {
  const host = parseDatabaseHost(connectionString);
  return host !== null && host.startsWith(NEON_PRODUCTION_COMPUTE_HOST);
}

/** Host legible para mensajes, sin exponer credenciales. */
export function safeHostOf(connectionString) {
  return parseDatabaseHost(connectionString) ?? "(url ilegible)";
}
