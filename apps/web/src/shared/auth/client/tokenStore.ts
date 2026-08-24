import { authClient } from "./authClient";

/**
 * Guarda el JWT en memoria y lo renueva cuando caduca.
 *
 * En memoria a propósito: no en localStorage ni en sessionStorage, donde un XSS
 * podría leerlo. Al recargar la página se pierde y se vuelve a pedir con la
 * cookie de sesión, que el navegador sí conserva de forma segura.
 *
 * `sessionPresent` lo actualiza AuthContext. Sin él, cada petición a la API
 * intentaría canjear un token inexistente y dispararía una llamada de red
 * inútil por request.
 */

const RENEW_MARGIN_SECONDS = 60;

let cachedToken: string | null = null;
let expiresAtSeconds = 0;
let sessionPresent = false;

function readExpiry(token: string): number {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]!)) as { exp?: number };
    return payload.exp ?? 0;
  } catch {
    return 0;
  }
}

export const tokenStore = {
  /** AuthContext informa de si hay sesión; sin ella no se pide token. */
  setSessionPresent(present: boolean): void {
    sessionPresent = present;

    if (!present) {
      cachedToken = null;
      expiresAtSeconds = 0;
    }
  },

  /** Token válido para llamar a la API, o null si no hay sesión. */
  async get(): Promise<string | null> {
    if (!sessionPresent) {
      return null;
    }

    const now = Math.floor(Date.now() / 1000);

    if (cachedToken && expiresAtSeconds - RENEW_MARGIN_SECONDS > now) {
      return cachedToken;
    }

    try {
      const token = await authClient.getToken();
      cachedToken = token;
      expiresAtSeconds = readExpiry(token);
      return token;
    } catch {
      // La sesión caducó entre peticiones: se trata como "sin token".
      cachedToken = null;
      expiresAtSeconds = 0;
      return null;
    }
  },

  clear(): void {
    cachedToken = null;
    expiresAtSeconds = 0;
    sessionPresent = false;
  }
};
