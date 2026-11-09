// ---------------------------------------------------------------------------
// Cliente HTTP de uazapi (uazapiGO v2): el proveedor que mantiene abiertas las
// sesiones de WhatsApp vinculadas por código QR. https://docs.uazapi.com
//
//   POST   /instance/create   admintoken   crear la sesión (instancia)
//   POST   /instance/connect  token        pedir el QR
//   GET    /instance/status   token        estado, QR renovado, número y perfil
//   POST   /instance/disconnect token      cerrar la sesión (o el QR en curso)
//   POST   /send/text · /send/media · /send/menu   token   enviar
//   POST   /message/react      token        reaccionar con un emoji
//   POST   /message/presence   token        «escribiendo…» / «grabando audio…»
//   POST   /message/download   token        enlace de un archivo recibido (2 días)
//   DELETE /instance          token        borrar la sesión
//   POST   /webhook           token        avisos de conexión a Auream
//
// Los tokens van en cabeceras (`admintoken`, `token`), nunca en la URL, y
// ningún mensaje de error los repite.
// ---------------------------------------------------------------------------

import { record, sentId, text, toInstanceInfo, type Json, type UazapiInstanceInfo } from "./uazapiResponses";

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

  /** Devuelve el id que WhatsApp le dio al mensaje (`messageid`), si viene. */
  public async sendText(token: string, number: string, text: string, replyId?: string): Promise<string | null> {
    return sentId(await this.request("POST", "/send/text", { token }, { number, text, ...(replyId ? { replyid: replyId } : {}) }));
  }

  /**
   * Presencia en el chat: `composing` («escribiendo…») o `recording` («grabando
   * audio…») durante `delayMs` (uazapi la renueva y la quita al enviar). Máx. 5 min.
   */
  public async presence(token: string, number: string, presence: "composing" | "recording" | "paused", delayMs: number): Promise<void> {
    await this.request("POST", "/message/presence", { token }, { number, presence, delay: Math.max(1_000, Math.min(Math.round(delayMs), 300_000)) });
  }

  /** `type`: image · video · audio · ptt · document (según la documentación de uazapi). */
  public async sendMedia(token: string, number: string, media: { readonly type: string; readonly file: string; readonly text?: string; readonly docName?: string }): Promise<string | null> {
    return sentId(await this.request("POST", "/send/media", { token }, {
      number,
      type: media.type,
      file: media.file,
      ...(media.text ? { text: media.text } : {}),
      ...(media.docName ? { docName: media.docName } : {})
    }));
  }

  /**
   * Botones o lista. `choices`: botones `"texto|id"`; lista: `"[Sección]"` y
   * `"texto|id|descripción"`.
   */
  public async sendMenu(
    token: string,
    number: string,
    menu: { readonly type: "button" | "list"; readonly text: string; readonly choices: ReadonlyArray<string>; readonly footerText?: string; readonly listButton?: string }
  ): Promise<string | null> {
    return sentId(await this.request("POST", "/send/menu", { token }, {
      number,
      type: menu.type,
      text: menu.text,
      choices: [...menu.choices],
      ...(menu.footerText ? { footerText: menu.footerText } : {}),
      ...(menu.listButton ? { listButton: menu.listButton } : {})
    }));
  }

  public async react(token: string, messageId: string, emoji: string): Promise<void> {
    await this.request("POST", "/message/react", { token }, { id: messageId, text: emoji });
  }

  /** Enlace público (2 días) y tipo de un archivo recibido. */
  public async downloadMedia(token: string, messageId: string): Promise<{ readonly url: string; readonly mimeType: string | null }> {
    const body = await this.request("POST", "/message/download", { token }, { id: messageId, return_base64: false, generate_mp3: true });
    const url = text(body["fileURL"]);
    if (!url) throw new UazapiError("unavailable", "uazapi no devolvió el archivo.");
    return { url, mimeType: text(body["mimetype"]) || null };
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

  /**
   * Avisos de la instancia a Auream (modo simple: uno por instancia). Sin
   * excluir lo enviado por la API: ese filtro también se come los avisos de
   * entregado/leído de nuestros mensajes. Los mensajes propios que lleguen se
   * descartan al leerlos (`parseUazapiMessage`), así no hay bucles.
   */
  public async setWebhook(token: string, url: string, events: ReadonlyArray<string>): Promise<void> {
    await this.request("POST", "/webhook", { token }, { enabled: true, url, events: [...events], excludeMessages: [] });
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
    if (response.status === 503) throw new UazapiError("unavailable", "uazapi no está disponible o el número no está conectado (503).");
    throw new UazapiError("unavailable", `uazapi respondió ${response.status}.`);
  }
}
