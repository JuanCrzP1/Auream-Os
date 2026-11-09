import { record, text, type Json } from "./uazapiResponses";

// ---------------------------------------------------------------------------
// El transporte HTTP de uazapi: cabeceras de autenticación (nunca en la URL),
// plazo, lectura del cuerpo y traducción de los errores a `UazapiError` (sin
// repetir credenciales). Los clientes (`UazapiClient`) solo dicen qué pedir.
// ---------------------------------------------------------------------------

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface UazapiCredentials {
  /** `https://<subdominio>.uazapi.com`, sin barra final. */
  readonly baseUrl: string;
  readonly adminToken: string;
}

/**
 * Por qué falló:
 *   unauthorized  la credencial no vale (o la instancia ya no existe)
 *   not_found     la instancia no existe
 *   conflict      ya hay una conexión en curso
 *   rate_limited · unavailable (5xx, caída, sin respuesta)
 */
export type UazapiFailure = "unauthorized" | "not_found" | "conflict" | "rate_limited" | "unavailable";

export class UazapiError extends Error {
  public constructor(
    public readonly reason: UazapiFailure,
    message: string
  ) {
    super(message);
  }
}

const TIMEOUT_MS = 15_000;

export class UazapiHttp {
  private readonly baseUrl: string;

  public constructor(
    credentials: Pick<UazapiCredentials, "baseUrl">,
    private readonly fetchImpl: FetchLike = fetch
  ) {
    this.baseUrl = credentials.baseUrl.replace(/\/+$/, "");
  }

  public async request(method: string, path: string, auth: Readonly<Record<string, string>>, payload?: Json): Promise<Json> {
    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method,
        headers: { accept: "application/json", ...(payload ? { "content-type": "application/json" } : {}), ...auth },
        ...(payload ? { body: JSON.stringify(payload) } : {}),
        signal: AbortSignal.timeout(TIMEOUT_MS)
      });
    } catch (error) {
      const name = (error as { name?: string } | null)?.name;
      throw new UazapiError("unavailable", name === "TimeoutError" || name === "AbortError" ? "uazapi no respondió a tiempo." : "No se pudo conectar con uazapi.");
    }

    const raw = await response.text().catch(() => "");
    let body: Json = {};
    try {
      body = raw ? record(JSON.parse(raw)) : {};
    } catch {
      body = {};
    }
    if (response.ok) return body;

    if (response.status === 401) throw new UazapiError("unauthorized", "uazapi rechazó la credencial.");
    if (response.status === 404) throw new UazapiError("not_found", "La sesión ya no existe en uazapi.");
    if (response.status === 409) throw new UazapiError("conflict", "Ya hay una vinculación en curso.");
    if (response.status === 429) {
      const limit = text(body["error"]).toLowerCase().includes("limit") && path === "/instance/create";
      throw new UazapiError("rate_limited", limit ? "Tu plan de uazapi llegó al máximo de números." : "uazapi está limitando las peticiones. Intenta en unos segundos.");
    }
    if (response.status === 503) throw new UazapiError("unavailable", "uazapi no está disponible o el número no está conectado (503).");
    throw new UazapiError("unavailable", `uazapi respondió ${response.status}.`);
  }
}
