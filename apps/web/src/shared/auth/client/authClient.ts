import { authFetch } from "./authFetch";

/**
 * Cliente de identidad. Único punto del frontend que conoce Neon Auth.
 *
 * La sesión la mantiene el proveedor en una cookie de su dominio; aquí no se
 * guarda ninguna credencial. El JWT se pide bajo demanda y vive en memoria.
 */

export interface AuthenticatedUser {
  readonly id: string;
  readonly email: string;
  readonly name: string;
}

interface SessionResponse {
  readonly user?: AuthenticatedUser;
}

interface TokenResponse {
  readonly token: string;
}

export const authClient = {
  /** Sesión actual, o null si no hay. Se usa al recargar para restaurarla. */
  async getSession(): Promise<AuthenticatedUser | null> {
    const session = await authFetch<SessionResponse | null>("/get-session");
    return session?.user ?? null;
  },

  async signInWithEmail(email: string, password: string): Promise<AuthenticatedUser> {
    const result = await authFetch<{ user: AuthenticatedUser }>("/sign-in/email", {
      method: "POST",
      body: JSON.stringify({ email, password })
    });

    return result.user;
  },

  async signUpWithEmail(
    email: string,
    password: string,
    name: string
  ): Promise<AuthenticatedUser> {
    const result = await authFetch<{ user: AuthenticatedUser }>("/sign-up/email", {
      method: "POST",
      body: JSON.stringify({ email, password, name })
    });

    return result.user;
  },

  async signOut(): Promise<void> {
    // El endpoint exige un cuerpo JSON aunque no reciba datos: sin él responde
    // 400 y la sesión NO se invalida.
    await authFetch<unknown>("/sign-out", { method: "POST", body: "{}" });
  },

  /**
   * Canjea la sesión por un JWT para llamar a nuestra API.
   *
   * Es de vida corta (15 min): se vuelve a pedir cuando caduca, sin que el
   * usuario tenga que iniciar sesión otra vez.
   */
  async getToken(): Promise<string> {
    const result = await authFetch<TokenResponse>("/token");
    return result.token;
  }
};
