// ---------------------------------------------------------------------------
// Disparadores de una conexión de WhatsApp: qué flujo arranca cuando un
// cliente escribe a ESE número. Contrato compartido por la API, la pantalla
// y el motor (que lo evaluará con cada mensaje entrante, FASE D4).
//
// Tipos (de más específico a más general; el más específico gana):
//   keyword        el mensaje es, empieza por o contiene una palabra clave
//   ad_click       el cliente llega desde un anuncio de clic a WhatsApp
//   first_message  es el primer mensaje de un contacto nuevo
//   any_message    cualquier mensaje (respaldo)
//
// Un disparador solo arranca un flujo si el contacto NO está ya dentro de
// uno en esa conversación (lo que esté en curso termina primero).
// ---------------------------------------------------------------------------

export type ConnectionTriggerType = "keyword" | "ad_click" | "first_message" | "any_message";
export const CONNECTION_TRIGGER_TYPES: ReadonlyArray<ConnectionTriggerType> = ["keyword", "ad_click", "first_message", "any_message"];

export type KeywordMatch = "contains" | "exact" | "starts_with";
export const KEYWORD_MATCHES: ReadonlyArray<KeywordMatch> = ["contains", "exact", "starts_with"];

export const MAX_TRIGGER_KEYWORDS = 20;
export const MAX_KEYWORD_LENGTH = 60;
export const MAX_TRIGGERS_PER_CONNECTION = 30;

export interface ConnectionTrigger {
  readonly id: string;
  readonly connectionId: string;
  readonly type: ConnectionTriggerType;
  /** Solo `keyword`. Tal como las escribió el usuario. */
  readonly keywords: ReadonlyArray<string>;
  /** Solo `keyword`. */
  readonly match: KeywordMatch;
  /** Flujo que arranca (`automations.id`). */
  readonly automationId: string;
  /** Nombre del flujo, para mostrarlo (lo resuelve la API). */
  readonly automationName: string;
  readonly enabled: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface SaveConnectionTriggerRequest {
  readonly type: ConnectionTriggerType;
  readonly keywords?: ReadonlyArray<string>;
  readonly match?: KeywordMatch;
  readonly automationId: string;
  readonly enabled?: boolean;
}

/** Lo que se sabe de un mensaje entrante para elegir el disparador. */
export interface InboundTriggerFacts {
  readonly text: string;
  /** Es el primer mensaje de este contacto en la cuenta. */
  readonly isNewContact: boolean;
  /** Llegó desde un anuncio de clic a WhatsApp (trae `ctwa_clid`). */
  readonly fromAd: boolean;
}

/** Texto comparable: minúsculas, sin tildes, sin signos y con espacios simples. */
export function normalizeTriggerText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** ¿El mensaje activa esta palabra clave? `contains` busca la palabra o frase completa. */
export function keywordMatches(text: string, keyword: string, match: KeywordMatch): boolean {
  const message = normalizeTriggerText(text);
  const word = normalizeTriggerText(keyword);
  if (!message || !word) return false;
  if (match === "exact") return message === word;
  if (match === "starts_with") return message === word || message.startsWith(`${word} `);
  return ` ${message} `.includes(` ${word} `);
}

const SPECIFICITY: Readonly<Record<ConnectionTriggerType, number>> = { keyword: 0, ad_click: 1, first_message: 2, any_message: 3 };

/**
 * El disparador que corresponde al mensaje, o `null`. Gana el más específico
 * (palabra clave > anuncio > primer mensaje > cualquier mensaje); entre
 * palabras clave, el que se creó primero.
 */
export function selectTrigger<T extends Pick<ConnectionTrigger, "type" | "keywords" | "match" | "enabled" | "createdAt">>(
  triggers: ReadonlyArray<T>,
  facts: InboundTriggerFacts
): T | null {
  const candidates = triggers
    .filter((trigger) => trigger.enabled)
    .filter((trigger) => {
      switch (trigger.type) {
        case "keyword":
          return trigger.keywords.some((keyword) => keywordMatches(facts.text, keyword, trigger.match));
        case "ad_click":
          return facts.fromAd;
        case "first_message":
          return facts.isNewContact;
        case "any_message":
          return true;
      }
    })
    .sort((a, b) => SPECIFICITY[a.type] - SPECIFICITY[b.type] || a.createdAt.localeCompare(b.createdAt));
  return candidates[0] ?? null;
}
