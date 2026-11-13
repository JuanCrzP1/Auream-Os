import { INTEGRATION_LIMITS, methodHasBody, type IntegrationConfig } from "../../../contracts/IntegrationConfig";
import { renderTemplate, type VariableResolver } from "../../../contracts/TemplateVariables";
import type { OutboundHttpRequest } from "../../ports/HttpRequester";

// ---------------------------------------------------------------------------
// De la configuración del bloque a una petición HTTP concreta. Pura.
//
// Cada variable se codifica según dónde cae (URL, cabecera o JSON), así un
// valor del cliente —su nombre, su último mensaje— nunca cambia la forma de
// la petición. Lo que no se puede enviar se rechaza aquí, antes de la red.
// ---------------------------------------------------------------------------

export type RequestBuildFailure = "invalid_url" | "invalid_header" | "body_too_large";

export type RequestBuild =
  | { readonly ok: true; readonly request: OutboundHttpRequest; readonly missingVariables: ReadonlyArray<string> }
  | { readonly ok: false; readonly reason: RequestBuildFailure; readonly message: string };

/** Nombre de cabecera válido (RFC 9110, `token`). */
const HEADER_NAME = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;

/** Cabeceras que pone el cliente HTTP, no el usuario. */
const MANAGED_HEADERS: ReadonlySet<string> = new Set([
  "host", "content-length", "connection", "transfer-encoding", "keep-alive", "upgrade", "te", "trailer", "proxy-connection"
]);

const DEFAULT_USER_AGENT = "Auream-Integrations/1.0";

function looksLikeJson(body: string): boolean {
  const trimmed = body.trim();
  return trimmed.startsWith("{") || trimmed.startsWith("[");
}

export function buildIntegrationRequest(config: IntegrationConfig, resolve: VariableResolver): RequestBuild {
  const missing = new Set<string>();
  const track = (rendered: { text: string; missing: ReadonlyArray<string> }) => {
    rendered.missing.forEach((name) => missing.add(name));
    return rendered.text;
  };

  // --- URL ------------------------------------------------------------------
  const rawUrl = track(renderTemplate(config.url, resolve, "url"));
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { ok: false, reason: "invalid_url", message: "La URL no es válida." };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, reason: "invalid_url", message: "La URL debe empezar por http:// o https://." };
  }
  if (url.username || url.password) {
    return { ok: false, reason: "invalid_url", message: "La URL no puede llevar usuario ni contraseña; usa una cabecera Authorization." };
  }

  // --- Cabeceras ------------------------------------------------------------
  const headers: Record<string, string> = {};
  const named = config.headers.filter((header) => header.key.trim().length > 0);
  if (named.length > INTEGRATION_LIMITS.maxHeaders) {
    return { ok: false, reason: "invalid_header", message: `Como máximo ${INTEGRATION_LIMITS.maxHeaders} cabeceras.` };
  }
  for (const header of named) {
    const name = header.key.trim();
    if (!HEADER_NAME.test(name)) {
      return { ok: false, reason: "invalid_header", message: `La cabecera «${name}» no tiene un nombre válido.` };
    }
    if (MANAGED_HEADERS.has(name.toLowerCase())) continue;
    // Sin saltos de línea en ningún caso: ni del valor de una variable ni escritos a mano.
    headers[name.toLowerCase()] = track(renderTemplate(header.value, resolve, "header")).replace(/[\r\n]+/g, " ").trim();
  }
  headers["user-agent"] ??= DEFAULT_USER_AGENT;

  // --- Cuerpo ---------------------------------------------------------------
  let body: string | undefined;
  if (methodHasBody(config.method) && config.body.trim().length > 0) {
    const declared = headers["content-type"];
    const isJson = declared !== undefined ? declared.toLowerCase().includes("json") : looksLikeJson(config.body);
    body = track(renderTemplate(config.body, resolve, isJson ? "json" : "raw"));
    if (isJson && declared === undefined) headers["content-type"] = "application/json";
    if (new TextEncoder().encode(body).length > INTEGRATION_LIMITS.maxRequestBodyBytes) {
      return { ok: false, reason: "body_too_large", message: "El cuerpo supera el tamaño máximo (256 KB)." };
    }
  }

  return {
    ok: true,
    request: {
      method: config.method,
      url: url.toString(),
      headers,
      ...(body !== undefined ? { body } : {}),
      timeoutMs: INTEGRATION_LIMITS.timeoutMs
    },
    missingVariables: [...missing]
  };
}
