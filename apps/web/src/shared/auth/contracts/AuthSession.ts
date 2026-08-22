/**
 * AuthSession — contrato de la sesión autenticada del usuario.
 *
 * El tenantId siempre viene de la sesión autenticada.
 * NUNCA hardcodeado en componentes ni hooks.
 */
export interface AuthSession {
  /** Identificador del tenant al que pertenece el usuario autenticado. */
  tenantId: string;
  /** Identificador del usuario dentro del tenant. */
  userId: string;
  /**
   * Token de autenticación para llamadas API.
   * null = modo API key (dev). string = Bearer token (producción).
   */
  token: string | null;
}
