import { readEnum, readItems, readString } from "./ConfigReaders";

// ---------------------------------------------------------------------------
// Integración — contrato de configuración compartido por el builder (editor) y
// el motor (IntegrationNodeHandler). Una petición HTTP a un servicio externo,
// con variables, y el mapeo de datos de la respuesta a campos del contacto.
// ---------------------------------------------------------------------------

export const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;
export type HttpMethod = (typeof HTTP_METHODS)[number];

export interface HttpHeader {
  readonly id: string;
  readonly key: string;
  readonly value: string;
}

/** Guarda un dato de la respuesta en un campo del contacto. */
export interface ResponseMapping {
  readonly id: string;
  /** Ruta en la respuesta: `id`, `data.items[0].id`, `status`, `headers.location`. */
  readonly path: string;
  /** Campo personalizado del contacto donde se guarda. */
  readonly field: string;
}

export interface IntegrationConfig {
  readonly method: HttpMethod;
  readonly url: string;
  readonly headers: ReadonlyArray<HttpHeader>;
  /** JSON o texto; admite variables. Ignorado en GET/DELETE. */
  readonly body: string;
  readonly responseMappings: ReadonlyArray<ResponseMapping>;
}

/** Límites de una petición. */
export const INTEGRATION_LIMITS = {
  timeoutMs: 10_000,
  maxRedirects: 3,
  maxHeaders: 30,
  maxRequestBodyBytes: 256 * 1024,
  maxResponseBodyBytes: 1024 * 1024
} as const;

export const INTEGRATION_DEFAULT_CONFIG: IntegrationConfig = {
  method: "POST",
  url: "",
  headers: [{ id: "h-1", key: "Content-Type", value: "application/json" }],
  body: '{\n  "nombre": "{full_name}",\n  "telefono": "{phone}"\n}',
  responseMappings: []
};

export function readIntegrationConfig(config: Readonly<Record<string, unknown>>): IntegrationConfig {
  return {
    method: readEnum(config["method"], HTTP_METHODS, "POST"),
    url: readString(config["url"]).trim(),
    headers: readItems(config["headers"], "h", (record, id) => ({
      id,
      key: readString(record["key"]),
      value: readString(record["value"])
    })),
    body: readString(config["body"]),
    responseMappings: readItems(config["responseMappings"], "m", (record, id) => ({
      id,
      path: readString(record["path"]),
      field: readString(record["field"])
    }))
  };
}

export function methodHasBody(method: HttpMethod): boolean {
  return method !== "GET" && method !== "DELETE";
}

/** Ids persistidos de las salidas. */
export const INTEGRATION_OUTPUT = { success: "success", failure: "failure" } as const;

/** Salidas del bloque, en el orden en que se pintan. */
export const INTEGRATION_OUTPUTS = [
  { id: INTEGRATION_OUTPUT.success, label: "Éxito" },
  { id: INTEGRATION_OUTPUT.failure, label: "Error" }
] as const;
