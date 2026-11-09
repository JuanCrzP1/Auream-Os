import type { PaymentAccount, PaymentProofConfig } from "../../../contracts/PaymentProofConfig";
import { PAYMENT_PROOF_OUTPUT } from "../../../contracts/PaymentProofConfig";
import { allProviders, findProvider } from "../../../contracts/PaymentProviders";
import type { ReceiptFacts } from "./extractReceipt";
import { compactKey, digitsOnly, MASKED_DIGITS, mentions, nameAppears, nameWords, textWords, type TextWord } from "./receiptText";

// ---------------------------------------------------------------------------
// ¿El comprobante cumple lo que pidió el negocio? Pura.
//
// Orden de las verificaciones (la primera que falla decide la salida):
//
//   1. ¿Es un comprobante?             → «No es un comprobante»
//   2. ¿El destino es una de las cuentas? → «Cuenta no registrada»
//   3. ¿El titular coincide?            → «Titular incorrecto»
//   4. ¿El valor es el esperado?        → «Monto incorrecto»
//   5. ¿Es reciente?                    → «Comprobante antiguo»
//
// Lo repetido (6) necesita el registro de la cuenta: lo resuelve
// `runPaymentProofStep` solo si todo lo demás pasó.
// ---------------------------------------------------------------------------

export type ReceiptCheckId = "receipt" | "account" | "holder" | "amount" | "age" | "duplicate";

export interface ReceiptCheck {
  readonly id: ReceiptCheckId;
  readonly passed: boolean;
  /** Explicación para el negocio («Se leyó $ 120.000; se esperaban $ 149.900»). */
  readonly detail: string;
}

/** Resultado detallado de la revisión (nunca «rejected», que es solo una salida del bloque: `paymentProofRoute`). */
export type ReceiptOutput = Exclude<(typeof PAYMENT_PROOF_OUTPUT)[keyof typeof PAYMENT_PROOF_OUTPUT], "rejected">;

export interface ReceiptVerification {
  /** Salida por la que sale si nada más falla (falta lo repetido). */
  readonly output: ReceiptOutput;
  readonly checks: ReadonlyArray<ReceiptCheck>;
  /** Cuenta del negocio reconocida en el comprobante. */
  readonly account?: PaymentAccount;
  /** Entidad (banco o billetera) reconocida. */
  readonly bank?: string;
  /** Titular reconocido (el registrado en la cuenta). */
  readonly holder?: string;
}

export interface VerifyOptions {
  /** Valor esperado ya resuelto (las variables se resuelven antes). */
  readonly expectedAmount?: number;
  readonly now: Date;
}

// --- Cuenta y titular ----------------------------------------------------------

type AccountEvidence = "full" | "masked" | "none";

/** Líneas que hablan de la cuenta de destino. */
const ACCOUNT_LINE = /\b(cuenta|cta|producto|ahorros|corriente|celular|movil|llave|tarjeta|destino|clabe|cbu|cvu|chave)\b/;

/**
 * Finales de número visibles («*****4567» → «4567»). El OCR a veces convierte
 * los asteriscos en comillas o letras sueltas («e 4567»): en una línea de
 * cuenta que solo muestra un grupo corto de dígitos, ese grupo es el final.
 */
function maskedGroups(facts: ReceiptFacts): string[] {
  const groups = [...facts.folded.matchAll(MASKED_DIGITS)].map((match) => match[1]!);
  for (const line of facts.lines) {
    if (!ACCOUNT_LINE.test(line.folded)) continue;
    const digits = digitsOnly(line.folded);
    const tail = /(?<![\d.,])(\d{3,6})\s*$/.exec(line.folded);
    if (tail && digits.length === tail[1]!.length) groups.push(tail[1]!);
  }
  return groups;
}

function accountEvidence(account: PaymentAccount, facts: ReceiptFacts, masked: ReadonlyArray<string>): AccountEvidence {
  const number = account.number.trim();
  if (!number) return "none";

  const digits = digitsOnly(number);
  const isNumeric = /^[\d\s.\-/()+]+$/.test(number) && digits.length >= 4;
  if (!isNumeric) {
    const key = compactKey(number).replace(/^[@$]/, "");
    return key.length >= 3 && compactKey(facts.text).includes(key) ? "full" : "none";
  }

  // Completo en una línea (los separadores no importan). Un celular con
  // indicativo («+57 300…») también vale si el comprobante lo omite.
  const variants = digits.length > 10 ? [digits, digits.slice(-10)] : [digits];
  if (facts.lines.some((line) => variants.some((variant) => digitsOnly(line.folded).includes(variant)))) return "full";

  return masked.some((group) => group.length >= 3 && digits.endsWith(group)) ? "masked" : "none";
}

function holderAppears(account: PaymentAccount, words: ReadonlyArray<TextWord>): string | undefined {
  return [account.holder, ...account.holderAliases].find((name) => name.trim() && nameAppears(name, words)) ? account.holder : undefined;
}

interface AccountMatch {
  readonly account?: PaymentAccount;
  readonly evidence: AccountEvidence;
}

/**
 * La cuenta del comprobante. Un número completo basta; uno enmascarado
 * («terminada en 4567») solo si además se ve la entidad o el titular.
 */
function matchAccount(accounts: ReadonlyArray<PaymentAccount>, facts: ReceiptFacts, words: ReadonlyArray<TextWord>): AccountMatch {
  const masked = maskedGroups(facts);
  const scored = accounts.map((account) => ({ account, evidence: accountEvidence(account, facts, masked) }));

  const full = scored.find((entry) => entry.evidence === "full");
  if (full) return full;

  const maskedMatch = scored.find(
    (entry) =>
      entry.evidence === "masked" &&
      (mentions(facts.folded, findProvider(entry.account.country, entry.account.provider).name) || holderAppears(entry.account, words))
  );
  return maskedMatch ?? { evidence: "none" };
}

/** Entidad del pago: la de la cuenta reconocida o la primera del catálogo que aparece. */
function bankIn(facts: ReceiptFacts, account: PaymentAccount | undefined): string | undefined {
  if (account && account.provider !== "other") return findProvider(account.country, account.provider).name;

  let first: { readonly name: string; readonly at: number } | undefined;
  for (const provider of allProviders()) {
    if (!mentions(facts.folded, provider.name)) continue;
    const word = nameWords(provider.name).find((part) => part !== "banco" && part !== "de") ?? "";
    const at = facts.folded.indexOf(word);
    if (!first || at < first.at) first = { name: provider.name, at };
  }
  return first?.name;
}

// --- Valor y fecha -----------------------------------------------------------

/** Cierra la frase sin duplicar el punto («S.A.S.», «a. m.»). */
const sentence = (text: string): string => (text.endsWith(".") ? text : `${text}.`);

export function formatAmount(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat("es-CO", { style: "currency", currency, maximumFractionDigits: value % 1 === 0 ? 0 : 2 }).format(value);
  } catch {
    return `${value} ${currency}`;
  }
}

function amountCheck(config: PaymentProofConfig, facts: ReceiptFacts, expected: number | undefined): ReceiptCheck {
  const currency = config.amountCurrency;
  if (facts.amount === undefined) return { id: "amount", passed: false, detail: "No se encontró el valor del pago en el comprobante." };
  if (expected === undefined) return { id: "amount", passed: false, detail: "El monto esperado no es un número válido." };
  if (facts.currency && facts.currency !== currency) {
    return { id: "amount", passed: false, detail: `El pago está en ${facts.currency}; se esperaba ${currency}.` };
  }

  const read = formatAmount(facts.amount, currency);
  const wanted = formatAmount(expected, currency);
  if (config.amountCheck === "minimum") {
    return facts.amount + 0.005 >= expected
      ? { id: "amount", passed: true, detail: `Se pagó ${read} (mínimo ${wanted}).` }
      : { id: "amount", passed: false, detail: `Se pagó ${read}; el mínimo es ${wanted}.` };
  }
  return Math.abs(facts.amount - expected) < 0.005
    ? { id: "amount", passed: true, detail: `Se pagó ${read}, el valor exacto.` }
    : { id: "amount", passed: false, detail: `Se pagó ${read}; se esperaban ${wanted}.` };
}

const HOUR_MS = 3_600_000;
/** Margen para relojes desfasados: un comprobante «del futuro» hasta 1 hora. */
const CLOCK_SKEW_MS = HOUR_MS;

function ageCheck(config: PaymentProofConfig, facts: ReceiptFacts, now: Date): ReceiptCheck {
  if (!facts.date) return { id: "age", passed: false, detail: "No se encontró la fecha del pago en el comprobante." };
  const age = now.getTime() - facts.date.instant.getTime();
  // Sin hora se toma el final del día: el «futuro» llega hasta ese día completo.
  const skew = facts.date.hasTime ? CLOCK_SKEW_MS : 24 * HOUR_MS;
  if (age < -skew) return { id: "age", passed: false, detail: `La fecha del pago (${facts.date.text}) es posterior a hoy.` };
  if (age > config.maxAgeHours * HOUR_MS) {
    return { id: "age", passed: false, detail: `El pago es del ${facts.date.text}: tiene más de ${config.maxAgeHours} h.` };
  }
  return { id: "age", passed: true, detail: sentence(`Pago del ${facts.date.text}`) };
}

// --- Conjunto ----------------------------------------------------------------

/** Mínimo para considerar que hay un documento con texto. */
const MIN_TEXT_LENGTH = 15;

export function verifyReceipt(config: PaymentProofConfig, facts: ReceiptFacts, options: VerifyOptions): ReceiptVerification {
  const O = PAYMENT_PROOF_OUTPUT;
  const checks: ReceiptCheck[] = [];
  const words = textWords(facts.folded);

  const looksLikeReceipt = facts.text.replace(/\s/g, "").length >= MIN_TEXT_LENGTH && (facts.amount !== undefined || facts.hasReceiptWords);
  checks.push(
    looksLikeReceipt
      ? { id: "receipt", passed: true, detail: "Se leyó un comprobante de pago." }
      : { id: "receipt", passed: false, detail: "La imagen no parece un comprobante de pago (no tiene valor ni palabras de pago)." }
  );
  if (!looksLikeReceipt) return { output: O.invalid, checks };

  const match = matchAccount(config.accounts, facts, words);
  const account = match.account;
  const bank = bankIn(facts, account);
  let holder: string | undefined;

  const done = (output: ReceiptOutput): ReceiptVerification => ({
    output,
    checks,
    ...(account ? { account } : {}),
    ...(bank ? { bank } : {}),
    ...(holder ? { holder } : {})
  });

  if (config.matchAccount) {
    const passed = account !== undefined;
    checks.push({
      id: "account",
      passed,
      detail: passed
        ? `El pago llegó a ${account.alias || findProvider(account.country, account.provider).name}${match.evidence === "masked" ? " (número enmascarado)" : ""}.`
        : "El destino del pago no es ninguna de las cuentas registradas."
    });
    if (!passed) return done(O.wrongAccount);
  }

  if (config.matchHolder) {
    const candidates = account ? [account] : config.accounts;
    holder = candidates.map((candidate) => holderAppears(candidate, words)).find(Boolean);
    checks.push({
      id: "holder",
      passed: holder !== undefined,
      detail: holder ? sentence(`El titular coincide: ${holder}`) : "El titular del destino no coincide con el registrado."
    });
    if (!holder) return done(O.wrongHolder);
  } else if (account) {
    holder = holderAppears(account, words);
  }

  if (config.amountCheck !== "off") {
    const check = amountCheck(config, facts, options.expectedAmount);
    checks.push(check);
    if (!check.passed) return done(O.wrongAmount);
  }

  if (config.maxAgeEnabled) {
    const check = ageCheck(config, facts, options.now);
    checks.push(check);
    if (!check.passed) return done(O.tooOld);
  }

  return done(O.valid);
}
