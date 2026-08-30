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
let onSessionLost: (() => void) | null = null;

function readExpiry(token: string): number {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]!)) as { exp?: number };
    return payload.exp ?? 0;
  } catch {
    return 0;
  }
}

export const tokenStore = {
  /**
   * Aviso de que la sesión dejó de ser válida en el proveedor.
   *
   * Lo registra `AuthContext`. Sin él, una sesión revocada mientras la pestaña
   * sigue abierta dejaba al usuario dentro de la interfaz protegida: el token
   * ya no se podía renovar, cada llamada respondía 401 y nada devolvía el
   * estado a "anónimo" hasta recargar. Es alcanzable de verdad, porque cambiar
   * la contraseña revoca el resto de sesiones.
   */
  onSessionLost(handler: (() => void) | null): void {
    onSessionLost = handler;
  },

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
      // La sesión caducó o fue revocada entre peticiones. Además de quedarse
      // sin token, hay que avisar: si no, la aplicación seguiría mostrando la
      // interfaz de un usuario que ya no lo es.
      cachedToken = null;
      expiresAtSeconds = 0;
      sessionPresent = false;
      onSessionLost?.();
      return null;
    }
  },

  clear(): void {
    cachedToken = null;
    expiresAtSeconds = 0;
    sessionPresent = false;
  }
};
