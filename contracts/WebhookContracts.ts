import { asRecord, readString, readStringList } from "./ConfigReaders";

// ---------------------------------------------------------------------------
// Webhooks de entrada — contrato compartido por la API y la web (como en
// Leona): una dirección secreta que recibe datos (POST JSON) de cualquier
// sistema (n8n, Make, Hotmart, formularios…) y, con su MAPEO, identifica al
// cliente, guarda sus datos, pone o quita etiquetas e inicia un flujo.
// ---------------------------------------------------------------------------

export const WEBHOOK_LIMITS = {
  name: 60,
  path: 200,
  fields: 30,
  tags: 20,
  /** Lo más grande que se acepta de un envío. */
  payloadBytes: 256 * 1024
} as const;

/** Un campo del contacto que se llena con un dato del envío. */
export interface WebhookFieldMapping {
  /** Clave del campo personalizado del contacto. */
  readonly key: string;
  /** Dónde está en el envío: `data.buyer.city`, `items.0.name`. */
  readonly path: string;
}

export interface WebhookMapping {
  readonly phonePath: string;
  readonly namePath: string;
  readonly emailPath: string;
  /** Prefijo que se antepone a un teléfono que llega sin él (p. ej. «57»). */
  readonly defaultCountryCode: string;
  readonly fields: ReadonlyArray<WebhookFieldMapping>;
  readonly addTags: ReadonlyArray<string>;
  readonly removeTags: ReadonlyArray<string>;
  /** Flujo que se inicia (necesita la conexión del webhook). Vacío: ninguno. */
  readonly flowId: string;
}

export const EMPTY_WEBHOOK_MAPPING: WebhookMapping = {
  phonePath: "",
  namePath: "",
  emailPath: "",
  defaultCountryCode: "57",
  fields: [],
  addTags: [],
  removeTags: [],
  flowId: ""
};

/** Lee un mapeo guardado o enviado sin confiar en su forma (lo que falta, vacío). */
export function readWebhookMapping(raw: unknown): WebhookMapping {
  const value = asRecord(raw) ?? {};
  const fields = Array.isArray(value["fields"]) ? value["fields"] : [];
  return {
    phonePath: readString(value["phonePath"]).trim(),
    namePath: readString(value["namePath"]).trim(),
    emailPath: readString(value["emailPath"]).trim(),
    defaultCountryCode: readString(value["defaultCountryCode"], "57").replace(/\D/g, "") || "57",
    fields: fields
      .map((item) => asRecord(item))
      .filter((item): item is Record<string, unknown> => item !== null)
      .map((item) => ({ key: readString(item["key"]).trim(), path: readString(item["path"]).trim() })),
    addTags: readStringList(value["addTags"]),
    removeTags: readStringList(value["removeTags"]),
    flowId: readString(value["flowId"]).trim()
  };
}

export interface WebhookSummary {
  readonly id: string;
  readonly name: string;
  readonly enabled: boolean;
  /** Número de WhatsApp para iniciar flujos. `null`: sin conexión. */
  readonly connectionId: string | null;
  readonly receivedThisMonth: number;
  readonly lastReceivedAt: string | null;
  readonly createdAt: string;
}

export interface WebhookDetail extends WebhookSummary {
  /** La dirección secreta (POST). */
  readonly url: string;
  readonly mapping: WebhookMapping;
  /** El último envío recibido (para mapear con clic). */
  readonly sample: unknown;
  readonly sampleReceivedAt: string | null;
}

/**
 *   processed   se identificó al cliente y se hicieron las acciones
 *   sample      solo se guardó como ejemplo (falta mapear el teléfono)
 *   ignored     el webhook está desactivado
 *   failed      no se pudo (p. ej. sin teléfono válido): `error` dice por qué
 */
export type WebhookDeliveryOutcome = "processed" | "sample" | "ignored" | "failed";

export interface WebhookDelivery {
  readonly id: string;
  readonly receivedAt: string;
  readonly outcome: WebhookDeliveryOutcome;
  readonly phone: string | null;
  readonly contactId: string | null;
  readonly flowStarted: boolean;
  /** Lo que se hizo y lo que se omitió, en palabras. */
  readonly notes: ReadonlyArray<string>;
  readonly error: string | null;
  readonly payload: unknown;
}

export interface CreateWebhookRequest {
  readonly name: string;
  readonly connectionId?: string | null;
}

export interface UpdateWebhookRequest {
  readonly name?: string;
  readonly enabled?: boolean;
  readonly connectionId?: string | null;
  readonly mapping?: WebhookMapping;
}
