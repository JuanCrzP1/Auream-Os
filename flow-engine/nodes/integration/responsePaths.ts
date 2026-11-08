import type { OutboundHttpResponse } from "../../ports/HttpRequester";

// ---------------------------------------------------------------------------
// Leer datos de una respuesta por ruta. Pura.
//
//   id · data.items[0].id · data.items.0.id   → en el cuerpo JSON
//   body.id                                    → igual (prefijo opcional)
//   status                                     → código HTTP
//   headers.location                           → una cabecera
// ---------------------------------------------------------------------------

export type PathLookup = { readonly found: true; readonly value: unknown } | { readonly found: false };

/** El cuerpo como JSON, o `undefined` si no lo es. */
export function parseResponseJson(response: OutboundHttpResponse): unknown {
  if (response.body.trim().length === 0) return undefined;
  try {
    return JSON.parse(response.body) as unknown;
  } catch {
    return undefined;
  }
}

function segmentsOf(path: string): string[] | null {
  const segments: string[] = [];
  for (const part of path.split(".")) {
    const match = /^([^[\]]*)((?:\[\d+\])*)$/.exec(part);
    if (!match) return null;
    if (match[1]) segments.push(match[1]);
    for (const index of match[2]!.matchAll(/\[(\d+)\]/g)) segments.push(index[1]!);
  }
  return segments.length > 0 ? segments : null;
}

function walk(value: unknown, segments: ReadonlyArray<string>): PathLookup {
  let current = value;
  for (const segment of segments) {
    if (Array.isArray(current) && /^\d+$/.test(segment)) {
      current = current[Number(segment)];
    } else if (typeof current === "object" && current !== null && Object.prototype.hasOwnProperty.call(current, segment)) {
      current = (current as Record<string, unknown>)[segment];
    } else {
      return { found: false };
    }
    if (current === undefined) return { found: false };
  }
  return { found: true, value: current };
}

export function readResponsePath(response: OutboundHttpResponse, json: unknown, rawPath: string): PathLookup {
  const path = rawPath.trim();
  if (path === "status") return { found: true, value: response.status };
  if (path.startsWith("headers.")) {
    const value = response.headers[path.slice("headers.".length).toLowerCase()];
    return value === undefined ? { found: false } : { found: true, value };
  }

  const bodyPath = path === "body" ? "" : path.startsWith("body.") ? path.slice("body.".length) : path;
  if (bodyPath === "") return json === undefined ? { found: true, value: response.body } : { found: true, value: json };
  if (json === undefined) return { found: false };

  const segments = segmentsOf(bodyPath);
  return segments ? walk(json, segments) : { found: false };
}

export interface ResponsePath {
  readonly path: string;
  /** Valor de muestra (recortado). */
  readonly preview: string;
}

const MAX_PATHS = 60;
const MAX_DEPTH = 5;
const MAX_PREVIEW = 80;

function preview(value: unknown): string {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return text.length > MAX_PREVIEW ? `${text.slice(0, MAX_PREVIEW - 1)}…` : text;
}

/**
 * Rutas de los valores simples de un JSON, para ofrecerlas al configurar.
 * De los arreglos solo se recorre el primer elemento.
 */
export function listResponsePaths(json: unknown): ResponsePath[] {
  const paths: ResponsePath[] = [];

  const visit = (value: unknown, path: string, depth: number) => {
    if (paths.length >= MAX_PATHS) return;
    if (value === null || typeof value !== "object") {
      if (path) paths.push({ path, preview: preview(value) });
      return;
    }
    if (depth >= MAX_DEPTH) return;
    if (Array.isArray(value)) {
      if (value.length > 0) visit(value[0], `${path}[0]`, depth + 1);
      return;
    }
    for (const [key, child] of Object.entries(value)) {
      if (!/^[A-Za-z0-9_-]+$/.test(key)) continue;
      visit(child, path ? `${path}.${key}` : key, depth + 1);
    }
  };

  visit(json, "", 0);
  return paths;
}
