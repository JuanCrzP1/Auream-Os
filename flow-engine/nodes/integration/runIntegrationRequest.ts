import type { IntegrationConfig, ResponseMapping } from "../../../contracts/IntegrationConfig";
import {
  CONTACT_FIELD_KEY_PATTERN,
  MAX_CONTACT_FIELD_TEXT,
  type ContactFieldValue
} from "../../../contracts/ContactContracts";
import type { VariableResolver } from "../../../contracts/TemplateVariables";
import type { HttpFailureReason, HttpRequester, OutboundHttpResponse } from "../../ports/HttpRequester";
import { buildIntegrationRequest, type RequestBuildFailure } from "./buildIntegrationRequest";
import { parseResponseJson, readResponsePath } from "./responsePaths";

// ---------------------------------------------------------------------------
// Una ejecución de la Integración: construir → enviar → interpretar.
//
// La usan el bloque en un flujo y el botón «Probar» del editor (a través de la
// API): las dos rutas hacen exactamente lo mismo.
//
// Éxito = respuesta 2xx. Cualquier otra cosa (4xx/5xx, sin respuesta, petición
// imposible de construir) es un fallo con su motivo: el flujo sigue por «Error».
// ---------------------------------------------------------------------------

export type IntegrationFailureReason = RequestBuildFailure | HttpFailureReason | "http_error";

export interface IntegrationRun {
  readonly succeeded: boolean;
  readonly reason?: IntegrationFailureReason;
  readonly message?: string;
  readonly durationMs: number;
  readonly response?: OutboundHttpResponse;
  /** Cuerpo interpretado como JSON, si lo es. */
  readonly json?: unknown;
  readonly missingVariables: ReadonlyArray<string>;
}

export async function runIntegrationRequest(
  config: IntegrationConfig,
  resolve: VariableResolver,
  http: HttpRequester
): Promise<IntegrationRun> {
  const build = buildIntegrationRequest(config, resolve);
  if (!build.ok) return { succeeded: false, reason: build.reason, message: build.message, durationMs: 0, missingVariables: [] };

  const sent = await http.send(build.request);
  if (!sent.ok) {
    return { succeeded: false, reason: sent.reason, message: sent.message, durationMs: sent.durationMs, missingVariables: build.missingVariables };
  }

  const { response } = sent;
  const json = parseResponseJson(response);
  const succeeded = response.status >= 200 && response.status < 300;
  return {
    succeeded,
    ...(succeeded ? {} : { reason: "http_error" as const, message: `El servicio respondió ${response.status}.` }),
    durationMs: sent.durationMs,
    response,
    ...(json !== undefined ? { json } : {}),
    missingVariables: build.missingVariables
  };
}

export interface MappedFields {
  /** Campo → valor listo para guardar en el contacto. */
  readonly fields: Readonly<Record<string, ContactFieldValue>>;
  /** Rutas que no estaban en la respuesta (o venían vacías). */
  readonly missingPaths: ReadonlyArray<string>;
  /** Nombres de campo no válidos: no se guardan. */
  readonly invalidFields: ReadonlyArray<string>;
}

function toFieldValue(value: unknown): ContactFieldValue | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return text.slice(0, MAX_CONTACT_FIELD_TEXT);
}

/** Aplica el mapeo «ruta de la respuesta → campo del contacto». */
export function mapResponseFields(
  mappings: ReadonlyArray<ResponseMapping>,
  response: OutboundHttpResponse,
  json: unknown
): MappedFields {
  const fields: Record<string, ContactFieldValue> = {};
  const missingPaths: string[] = [];
  const invalidFields: string[] = [];

  for (const mapping of mappings) {
    const field = mapping.field.trim();
    if (!mapping.path.trim() || !field) continue;
    if (!CONTACT_FIELD_KEY_PATTERN.test(field)) {
      invalidFields.push(field);
      continue;
    }
    const lookup = readResponsePath(response, json, mapping.path);
    const value = lookup.found ? toFieldValue(lookup.value) : undefined;
    if (value === undefined) missingPaths.push(mapping.path.trim());
    else fields[field] = value;
  }

  return { fields, missingPaths, invalidFields };
}
