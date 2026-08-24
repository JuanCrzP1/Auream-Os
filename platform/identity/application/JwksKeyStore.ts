import type { KeyObject } from "node:crypto";

// ---------------------------------------------------------------------------
// JwksKeyStore — puerto
//
// Declara cómo el verificador obtiene una clave pública por `kid`. La descarga
// y el caché son infraestructura (`infrastructure/identity/HttpJwksKeyStore`);
// aquí sólo se declara la necesidad.
// ---------------------------------------------------------------------------

export interface JwksKeyStore {
  /**
   * Clave pública correspondiente a ese `kid`, o null si no existe.
   *
   * Devolver null obliga al verificador a rechazar el token: nunca debe existir
   * una clave "por defecto" con la que validar un kid desconocido.
   */
  findKey(kid: string): Promise<KeyObject | null>;
}
