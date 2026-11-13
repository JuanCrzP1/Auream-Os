import { ruleValues, type ConditionConfig, type ConditionRule } from "../../../contracts/ConditionConfig";
import { parseFieldNumber, sameTypedValue } from "../../../contracts/FieldValues";
import { compareTypedField } from "./typedFieldRules";

// ---------------------------------------------------------------------------
// Evaluación de las reglas del Condicional. Pura: recibe la configuración y
// los hechos disponibles, y devuelve si se cumple y el detalle por regla.
//
// NO SE INVENTAN DATOS. Lo que la plataforma aún no tiene (estado de la
// atención y asesor asignado llegan con Conversaciones) se reporta como «no
// disponible»: la regla cuenta como NO cumplida y queda registrado, en vez de
// suponer un valor. Las etiquetas vienen del contacto y las variables
// globales de Datos del negocio; si no se pudieron leer, también.
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
  /** Datos del negocio (`g_promo_activa`), con su tipo, o `undefined` si el motor no los conoce. */
  readonly business?: Readonly<Record<string, unknown>>;
}

/** Categorías cuyos datos todavía no existen en la plataforma. */
const UNAVAILABLE_CATEGORIES: ReadonlySet<string> = new Set(["attendance", "attendant"]);

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
/** Un sí o no de la ficha se lee como «sí»/«no»: «contiene "s"» funciona igual que con lo que escribió el cliente. */
function normalize(value: unknown): string {
  const text = typeof value === "boolean" ? (value ? "sí" : "no") : String(value);
  return text.trim().toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

function hasValue(value: unknown): boolean {
  return value !== undefined && value !== null && String(value).trim().length > 0;
}

/** Solo algo que ES un número («1.200.000», «$ 49.900», «12,5»), no un texto con un número adentro. */
const LOOKS_NUMERIC = /^\s*-?\$?\s*\d[\d.,\s]*$/;

function toNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string" || !LOOKS_NUMERIC.test(value)) return null;
  return parseFieldNumber(value.replace(/\s+/g, "")) ?? null;
}

/** ¿Es lo mismo? Con tipo cuando se puede («Sí» = sí); si no, como texto sin tildes ni mayúsculas. */
function sameValue(actual: unknown, expected: string): boolean {
  if (!hasValue(actual)) return false;
  return sameTypedValue(actual, expected) ?? normalize(actual) === normalize(expected);
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

  // Con tipo: «Sí» es sí, «13/11/1990» es la misma fecha que 1990-11-13, «1.200.000» es 1200000.
  const typed = operator === "equal" || operator === "different" ? sameTypedValue(actual, expected) : undefined;
  if (typed !== undefined) return operator === "equal" ? typed : !typed;

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
  const unknown = (rule.category === "tag" && facts.tags === undefined) || (rule.category === "globalVariable" && facts.business === undefined);
  if (UNAVAILABLE_CATEGORIES.has(rule.category) || unknown) {
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
      case "globalVariable": {
        // Un dato del negocio se compara con su tipo, igual que un campo del cliente.
        const actual = rule.category === "customField" ? facts.customField(rule.field) : facts.business?.[rule.field];
        const typed = compareTypedField(actual, rule.operator, ruleValues(rule), sameValue, zoned(facts.now, facts.timezone).date);
        return typed ?? compareField(actual, rule.operator, rule.value);
      }
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
