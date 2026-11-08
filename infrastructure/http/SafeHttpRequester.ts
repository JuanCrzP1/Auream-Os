import { request as httpRequest, type IncomingMessage } from "node:http";
import { request as httpsRequest } from "node:https";
import { lookup as dnsLookup, type LookupAddress } from "node:dns";
import { isIP, type LookupFunction } from "node:net";
import { brotliDecompressSync, gunzipSync, inflateSync } from "node:zlib";
import type {
  HttpFailureReason,
  HttpRequester,
  HttpSendResult,
  OutboundHttpRequest,
  OutboundHttpResponse
} from "../../flow-engine/ports/HttpRequester";
import { isBlockedAddress } from "./blockedAddresses";

// ---------------------------------------------------------------------------
// SafeHttpRequester — cliente HTTP saliente para integraciones de clientes.
//
// Garantías:
//   · Solo Internet público. La IP se comprueba DESPUÉS de resolver el DNS y
//     es la misma con la que se conecta (sin ventana para DNS rebinding); las
//     IP escritas en la URL se comprueban igual.
//   · Redirecciones: como máximo 3, cada salto con las mismas reglas. Al
//     cambiar de origen no viajan `Authorization` ni `Cookie`.
//   · Un plazo total (conexión + redirecciones + lectura) y un tope de tamaño
//     de respuesta, también tras descomprimir.
//
// `allowPrivateNetworks` existe solo para desarrollo y tests (servicios en
// localhost); la configuración de la API lo prohíbe en producción.
// ---------------------------------------------------------------------------

export interface SafeHttpRequesterOptions {
  readonly allowPrivateNetworks?: boolean;
  readonly maxRedirects?: number;
  readonly maxResponseBytes?: number;
}

const DEFAULT_MAX_REDIRECTS = 3;
const DEFAULT_MAX_RESPONSE_BYTES = 1024 * 1024;
const CROSS_ORIGIN_STRIPPED = ["authorization", "cookie", "proxy-authorization"];

class RequestFailure extends Error {
  public constructor(
    public readonly reason: HttpFailureReason,
    message: string
  ) {
    super(message);
  }
}

interface Hop {
  readonly method: string;
  readonly url: URL;
  readonly headers: Record<string, string>;
  readonly body?: string;
}

export class SafeHttpRequester implements HttpRequester {
  private readonly allowPrivate: boolean;
  private readonly maxRedirects: number;
  private readonly maxResponseBytes: number;

  public constructor(options: SafeHttpRequesterOptions = {}) {
    this.allowPrivate = options.allowPrivateNetworks ?? false;
    this.maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
    this.maxResponseBytes = options.maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES;
  }

  public async send(request: OutboundHttpRequest): Promise<HttpSendResult> {
    const started = Date.now();
    const deadline = started + request.timeoutMs;
    const elapsed = () => Date.now() - started;

    let hop: Hop;
    try {
      hop = {
        method: request.method,
        url: new URL(request.url),
        headers: { ...request.headers },
        ...(request.body !== undefined ? { body: request.body } : {})
      };
    } catch {
      return { ok: false, reason: "network_error", message: "La URL no es válida.", durationMs: 0 };
    }

    try {
      for (let redirects = 0; ; redirects++) {
        const response = await this.exchange(hop, deadline);
        const location = response.headers["location"];
        if (!isRedirect(response.status) || !location) return { ok: true, response, durationMs: elapsed() };
        if (redirects >= this.maxRedirects) {
          throw new RequestFailure("too_many_redirects", `Más de ${this.maxRedirects} redirecciones.`);
        }
        hop = nextHop(hop, response.status, new URL(location, hop.url));
      }
    } catch (error) {
      const failure = toFailure(error);
      return { ok: false, reason: failure.reason, message: failure.message, durationMs: elapsed() };
    }
  }

  /** Una petición y su respuesta, sin seguir redirecciones. */
  private exchange(hop: Hop, deadline: number): Promise<OutboundHttpResponse> {
    const { url } = hop;
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return Promise.reject(new RequestFailure("blocked_destination", "Solo se permiten direcciones http:// o https://."));
    }
    const literal = url.hostname.replace(/^\[|\]$/g, "");
    if (isIP(literal) && !this.allowPrivate && isBlockedAddress(literal)) {
      return Promise.reject(blocked());
    }

    const remaining = deadline - Date.now();
    if (remaining <= 0) return Promise.reject(new RequestFailure("timeout", "El servicio no respondió a tiempo."));

    return new Promise<OutboundHttpResponse>((resolve, reject) => {
      const send = url.protocol === "https:" ? httpsRequest : httpRequest;
      const req = send(
        url,
        {
          method: hop.method,
          headers: hop.body !== undefined ? { ...hop.headers, "content-length": String(Buffer.byteLength(hop.body)) } : hop.headers,
          lookup: this.lookup,
          agent: false
        },
        (res) => {
          readBody(res, this.maxResponseBytes)
            .then((body) => resolve({ status: res.statusCode ?? 0, headers: flatHeaders(res), body }))
            .catch(reject)
            .finally(() => clearTimeout(timer));
        }
      );
      const timer = setTimeout(() => req.destroy(new RequestFailure("timeout", "El servicio no respondió a tiempo.")), remaining);
      req.on("error", (error) => {
        clearTimeout(timer);
        reject(error);
      });
      if (hop.body !== undefined) req.write(hop.body);
      req.end();
    });
  }

  /** Resuelve el DNS y descarta direcciones internas antes de conectar. */
  private readonly lookup: LookupFunction = (hostname, options, callback) => {
    dnsLookup(hostname, { all: true, family: options.family ?? 0 }, (error, addresses: LookupAddress[]) => {
      if (error) return callback(error, "", 0);
      const allowed = this.allowPrivate ? addresses : addresses.filter((address) => !isBlockedAddress(address.address));
      if (allowed.length === 0) return callback(blocked() as NodeJS.ErrnoException, "", 0);
      if (options.all) return (callback as unknown as (error: null, addresses: LookupAddress[]) => void)(null, allowed);
      return callback(null, allowed[0]!.address, allowed[0]!.family);
    });
  };
}

function blocked(): RequestFailure {
  return new RequestFailure("blocked_destination", "La dirección apunta a una red interna o privada; solo se permiten servicios públicos de Internet.");
}

function isRedirect(status: number): boolean {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}

function nextHop(previous: Hop, status: number, target: URL): Hop {
  const headers = { ...previous.headers };
  if (target.origin !== previous.url.origin) CROSS_ORIGIN_STRIPPED.forEach((name) => delete headers[name]);

  // 303 siempre, y 301/302 tras un POST, continúan como GET sin cuerpo (como los navegadores).
  const toGet = status === 303 || ((status === 301 || status === 302) && previous.method === "POST");
  if (!toGet) return { ...previous, url: target, headers };
  delete headers["content-type"];
  return { method: "GET", url: target, headers };
}

function flatHeaders(res: IncomingMessage): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const [name, value] of Object.entries(res.headers)) {
    if (value !== undefined) headers[name.toLowerCase()] = Array.isArray(value) ? value.join(", ") : value;
  }
  return headers;
}

function readBody(res: IncomingMessage, maxBytes: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    res.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > maxBytes) {
        res.destroy();
        reject(tooLarge(maxBytes));
        return;
      }
      chunks.push(chunk);
    });
    res.on("error", reject);
    res.on("end", () => {
      try {
        resolve(decode(Buffer.concat(chunks), res.headers["content-encoding"], maxBytes).toString("utf8"));
      } catch (error) {
        reject(error instanceof RequestFailure ? error : new RequestFailure("network_error", "No se pudo leer la respuesta comprimida."));
      }
    });
  });
}

function decode(raw: Buffer, encoding: string | undefined, maxBytes: number): Buffer {
  const options = { maxOutputLength: maxBytes };
  try {
    switch (encoding?.trim().toLowerCase()) {
      case "gzip":
      case "x-gzip":
        return gunzipSync(raw, options);
      case "deflate":
        return inflateSync(raw, options);
      case "br":
        return brotliDecompressSync(raw, options);
      default:
        return raw;
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ERR_BUFFER_TOO_LARGE") throw tooLarge(maxBytes);
    throw error;
  }
}

function tooLarge(maxBytes: number): RequestFailure {
  return new RequestFailure("response_too_large", `La respuesta supera ${Math.round(maxBytes / 1024)} KB.`);
}

const NETWORK_MESSAGES: Readonly<Record<string, string>> = {
  ENOTFOUND: "No se encontró el dominio.",
  EAI_AGAIN: "No se pudo resolver el dominio.",
  ECONNREFUSED: "El servicio rechazó la conexión.",
  ECONNRESET: "El servicio cortó la conexión.",
  ETIMEDOUT: "El servicio no respondió a tiempo.",
  EHOSTUNREACH: "No se pudo llegar al servicio.",
  ENETUNREACH: "No se pudo llegar al servicio.",
  ERR_INVALID_CHAR: "Una cabecera tiene caracteres no válidos."
};

function toFailure(error: unknown): RequestFailure {
  if (error instanceof RequestFailure) return error;
  const code = (error as NodeJS.ErrnoException | undefined)?.code ?? "";
  if (code === "ETIMEDOUT") return new RequestFailure("timeout", NETWORK_MESSAGES[code]!);
  if (/CERT|SSL|TLS/i.test(code)) return new RequestFailure("network_error", "El certificado TLS del servicio no es válido.");
  return new RequestFailure("network_error", NETWORK_MESSAGES[code] ?? "No se pudo conectar con el servicio.");
}
