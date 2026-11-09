import {
  MAX_KEYWORD_LENGTH,
  MAX_TRIGGER_KEYWORDS,
  normalizeTriggerText,
  type ConnectionTriggerType,
  type KeywordMatch
} from "../../../contracts/ConnectionTriggerContracts";

/** Un disparador guardado: el flujo que arranca un número ante cierto mensaje. */
export interface ConnectionTriggerRecord {
  readonly id: string;
  readonly tenantId: string;
  readonly connectionId: string;
  readonly type: ConnectionTriggerType;
  readonly keywords: ReadonlyArray<string>;
  readonly match: KeywordMatch;
  readonly automationId: string;
  readonly enabled: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * Palabras clave limpias: sin espacios sobrantes y sin repetidas (dos que se
 * leen igual —«Precio» y «precio»— cuentan como una). `null` si alguna no vale.
 */
export function normalizeKeywords(values: unknown): string[] | null {
  if (!Array.isArray(values)) return null;
  const result: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    if (typeof value !== "string") return null;
    const keyword = value.trim().replace(/\s+/g, " ");
    if (!keyword) continue;
    if (keyword.length > MAX_KEYWORD_LENGTH || !normalizeTriggerText(keyword)) return null;
    const key = normalizeTriggerText(keyword);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(keyword);
  }
  return result.length > 0 && result.length <= MAX_TRIGGER_KEYWORDS ? result : null;
}
