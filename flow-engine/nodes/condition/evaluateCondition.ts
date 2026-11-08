import type { ConditionConfig, ConditionRule } from "../../../contracts/ConditionConfig";

// ---------------------------------------------------------------------------
// Evaluación de las reglas del Condicional. Pura: recibe la configuración y
// los hechos disponibles, y devuelve si se cumple y el detalle por regla.
//
// NO SE INVENTAN DATOS. Lo que la plataforma aún no tiene (estado de la
// atención y asesor asignado llegan con Conversaciones; variables globales
// con los ajustes de cuenta) se reporta como «no disponible»: la regla cuenta
// como NO cumplida y queda registrado, en vez de suponer un valor. Las
// etiquetas vienen del contacto; si no se pudieron leer, también.
// ---------------------------------------------------------------------------

/** Lo que el Condicional puede consultar sobre el contacto, la conversación y el momento. */
export interface ConditionFacts {
  /** Instante de la ejecución. */
  readonly now: Date;
  /** Zona horaria IANA del negocio. */
  readonly timezone: string;
  /** Último mensaje del cliente (ISO), o `null` si no se sabe. */
  readonly lastInboundAt: string | null;
  /** Dato del contacto (`name`, `phone`, `email`). `undefined` si no se tiene. */
  contactField(name: string): unknown;
  /** Campo personalizado (lo que el flujo guardó, p. ej. con «Esperar respuesta»). */
  customField(name: string): unknown;
  /** Etiquetas del contacto (por nombre), o `undefined` si no se pudieron leer. */
  readonly tags?: ReadonlyArray<string>;
}

/** Categorías cuyos datos todavía no existen en la plataforma. */
const UNAVAILABLE_CATEGORIES: ReadonlySet<string> = new Set(["attendance", "attendant", "globalVariable"]);

export interface RuleEvaluation {
  readonly ruleId: string;
  readonly met: boolean;
  /** El dato que la regla necesita aún no existe (ver cabecera). */
  readonly unavailable?: true;
}

export interface ConditionEvaluation {
  readonly met: boolean;
  readonly rules: ReadonlyArray<RuleEvaluation>;
}

const WINDOW_MS = 24 * 60 * 60 * 1000;

/** Día, fecha y minutos del día en la zona del negocio. */
function zoned(now: Date, timezone: string): { weekday: string; date: string; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "long",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(now);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return {
    weekday: get("weekday").toLowerCase(),
    date: `${get("year")}-${get("month")}-${get("day")}`,
    minutes: Number(get("hour")) * 60 + Number(get("minute"))
  };
}

/** «HH:mm» → minutos del día, o `null`. */
function minutesOf(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours < 24 && minutes < 60 ? hours * 60 + minutes : null;
}

/** Comparación de orden para hora y fecha. */
function compareOrder(actual: number | string, expected: number | string, operator: string): boolean {
  if (operator === "before") return actual < expected;
  if (operator === "after") return actual > expected;
  return actual === expected;
}

/** Texto comparable: sin espacios sobrantes, sin mayúsculas ni tildes. */
function normalize(value: unknown): string {
  return String(value).trim().toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

function hasValue(value: unknown): boolean {
  return value !== undefined && value !== null && String(value).trim().length > 0;
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string" || value.trim() === "") return null;
  const parsed = Number(value.trim().replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

/** Operadores de campo (dato del contacto, campo personalizado). */
function compareField(actual: unknown, operator: string, expected: string): boolean {
  if (operator === "has_value") return hasValue(actual);

  const numeric = { greater_than: (a: number, b: number) => a > b, less_than: (a: number, b: number) => a < b, greater_or_equal: (a: number, b: number) => a >= b, less_or_equal: (a: number, b: number) => a <= b } as const;
  if (operator in numeric) {
    const a = toNumber(actual);
    const b = toNumber(expected);
    return a !== null && b !== null && numeric[operator as keyof typeof numeric](a, b);
  }

  // Sin valor: no es igual, no contiene ni empieza por nada; sí es «distinto» y «no contiene».
  if (!hasValue(actual)) return operator === "different" || operator === "not_contains";

  const a = normalize(actual);
  const b = normalize(expected);
  switch (operator) {
    case "equal":
      return a === b;
    case "different":
      return a !== b;
    case "contains":
      return a.includes(b);
    case "not_contains":
      return !a.includes(b);
    case "starts_with":
      return a.startsWith(b);
    default:
      return false;
  }
}

function evaluateRule(rule: ConditionRule, facts: ConditionFacts): RuleEvaluation {
  if (UNAVAILABLE_CATEGORIES.has(rule.category) || (rule.category === "tag" && facts.tags === undefined)) {
    return { ruleId: rule.id, met: false, unavailable: true };
  }

  const met = ((): boolean => {
    switch (rule.category) {
      case "tag": {
        const has = (facts.tags ?? []).some((tag) => normalize(tag) === normalize(rule.value));
        return rule.operator === "different" ? !has : has;
      }
      case "weekday": {
        const same = zoned(facts.now, facts.timezone).weekday === rule.value;
        return rule.operator === "different" ? !same : same;
      }
      case "time": {
        const expected = minutesOf(rule.value);
        return expected !== null && compareOrder(zoned(facts.now, facts.timezone).minutes, expected, rule.operator);
      }
      case "date":
        return /^\d{4}-\d{2}-\d{2}$/.test(rule.value) && compareOrder(zoned(facts.now, facts.timezone).date, rule.value, rule.operator);
      case "messageWindow": {
        const last = facts.lastInboundAt ? new Date(facts.lastInboundAt).getTime() : Number.NaN;
        const open = Number.isFinite(last) && facts.now.getTime() - last < WINDOW_MS;
        return rule.operator === "open" ? open : !open;
      }
      case "contactField":
        return compareField(facts.contactField(rule.field), rule.operator, rule.value);
      case "customField":
        return compareField(facts.customField(rule.field), rule.operator, rule.value);
      default:
        return false;
    }
  })();

  return { ruleId: rule.id, met };
}

export function evaluateCondition(config: ConditionConfig, facts: ConditionFacts): ConditionEvaluation {
  const rules = config.rules.map((rule) => evaluateRule(rule, facts));
  if (rules.length === 0) return { met: false, rules };

  const met = config.match === "any" ? rules.some((rule) => rule.met) : rules.every((rule) => rule.met);
  return { met, rules };
}
