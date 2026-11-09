// ---------------------------------------------------------------------------
// Cliente HTTP de uazapi (uazapiGO v2): el proveedor que mantiene abiertas las
// sesiones de WhatsApp vinculadas por código QR. https://docs.uazapi.com
//
//   POST   /instance/create   admintoken   crear la sesión (instancia)
//   POST   /instance/connect  token        pedir el QR
//   GET    /instance/status   token        estado, QR renovado, número y perfil
//   POST   /instance/disconnect token      cerrar la sesión (o el QR en curso)
//   DELETE /instance          token        borrar la sesión
//   POST   /webhook           token        avisos de conexión a Auream
//
// Los tokens van en cabeceras (`admintoken`, `token`), nunca en la URL, y
// ningún mensaje de error los repite.
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

export interface UazapiInstanceInfo {
  readonly id: string;
  readonly token: string;
  /** `disconnected` · `connecting` · `connected` · `hibernated`. */
  readonly status: string;
  /** QR como data URL (vacío mientras se genera). */
  readonly qrcode: string;
  readonly profileName: string | null;
  /** Número conectado, solo dígitos (de `status.jid.user`). */
  readonly phoneNumber: string | null;
}

const TIMEOUT_MS = 15_000;

type Json = Record<string, unknown>;

const record = (value: unknown): Json => (typeof value === "object" && value !== null ? (value as Json) : {});
const text = (value: unknown): string => (typeof value === "string" ? value : "");

function digits(value: unknown): string | null {
  const only = text(value).split("@")[0]!.replace(/\D/g, "");
  return only.length >= 7 && only.length <= 15 ? only : null;
}

/** Algunos servidores devuelven el PNG sin el prefijo `data:`. */
function asDataUrl(qr: string): string {
  if (!qr) return "";
  return qr.startsWith("data:") ? qr : `data:image/png;base64,${qr}`;
}

function toInstanceInfo(body: Json): UazapiInstanceInfo {
  const instance = record(body["instance"]);
  const status = record(body["status"]);
  const jid = record(status["jid"] ?? body["jid"]);
  return {
    id: text(instance["id"]),
    token: text(instance["token"] ?? body["token"]),
    status: text(instance["status"]) || (status["connected"] === true || body["connected"] === true ? "connected" : "disconnected"),
    qrcode: asDataUrl(text(instance["qrcode"])),
    profileName: text(instance["profileName"]) || null,
    phoneNumber: digits(jid["user"]) ?? digits(instance["owner"])
  };
}

export class UazapiClient {
  private readonly baseUrl: string;

  public constructor(
    private readonly credentials: UazapiCredentials,
    private readonly fetchImpl: FetchLike = fetch
  ) {
    this.baseUrl = credentials.baseUrl.replace(/\/+$/, "");
  }

  /** Crea una instancia (desconectada) y devuelve su id y su token. */
  public async createInstance(name: string, systemName: string): Promise<{ readonly id: string; readonly token: string }> {
    const body = await this.request("POST", "/instance/create", { admintoken: this.credentials.adminToken }, { name, systemName });
    const info = toInstanceInfo(body);
    const token = info.token || text(body["token"]);
    if (!info.id || !token) throw new UazapiError("unavailable", "uazapi no devolvió la instancia creada.");
    return { id: info.id, token };
  }

  /** Pide el QR. Si ya hay una conexión en curso, devuelve el estado (con su QR). */
  public async connect(token: string): Promise<UazapiInstanceInfo> {
    try {
      return toInstanceInfo(await this.request("POST", "/instance/connect", { token }, {}));
    } catch (error) {
      if (error instanceof UazapiError && error.reason === "conflict") return this.status(token);
      throw error;
    }
  }

  public async status(token: string): Promise<UazapiInstanceInfo> {
    return toInstanceInfo(await this.request("GET", "/instance/status", { token }));
  }

  /** Cierra la sesión o la vinculación en curso; la instancia sigue existiendo. */
  public async disconnect(token: string): Promise<void> {
    await this.request("POST", "/instance/disconnect", { token });
  }

  /** Borra la instancia. Si ya no existía, no es un error. */
  public async deleteInstance(token: string): Promise<void> {
    try {
      await this.request("DELETE", "/instance", { token });
    } catch (error) {
      if (error instanceof UazapiError && (error.reason === "not_found" || error.reason === "unauthorized")) return;
      throw error;
    }
  }

  /** Avisos de la instancia a Auream (modo simple: uno por instancia). */
  public async setWebhook(token: string, url: string, events: ReadonlyArray<string>): Promise<void> {
    await this.request("POST", "/webhook", { token }, { enabled: true, url, events, excludeMessages: ["wasSentByApi"] });
  }

  private async request(method: string, path: string, auth: Readonly<Record<string, string>>, payload?: Json): Promise<Json> {
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
    throw new UazapiError("unavailable", `uazapi respondió ${response.status}.`);
  }
}
