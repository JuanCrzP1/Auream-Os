import { createHash } from "node:crypto";
import type { PaymentProofConfig, PaymentProofField } from "../../../contracts/PaymentProofConfig";
import { PAYMENT_PROOF_OUTPUT } from "../../../contracts/PaymentProofConfig";
import { renderTemplate, type VariableResolver } from "../../../contracts/TemplateVariables";
import type { DocumentInput, DocumentTextMethod, DocumentTextReader } from "../../ports/DocumentTextReader";
import type { MediaFetcher } from "../../ports/MediaFetcher";
import type { ReceiptRegistry } from "../../ports/ReceiptRegistry";
import { parseAmount } from "../../values/parseAmount";
import { extractReceipt, type ReceiptFacts } from "./extractReceipt";
import { formatAmount, verifyReceipt, type ReceiptCheck, type ReceiptOutput, type ReceiptVerification } from "./verifyReceipt";

// ---------------------------------------------------------------------------
// Una ejecución del Comprobante automático:
//
//   archivo (variable) → descargar → leer el texto (OCR / PDF) → extraer datos
//   → verificar contra las cuentas → ¿repetido? → salida + datos
//
// La usan el bloque en un flujo y «Probar» del editor (que entrega el archivo
// directamente y NO registra el comprobante: solo consulta si ya se usó).
// ---------------------------------------------------------------------------

export interface PaymentProofPorts {
  readonly fetcher: MediaFetcher;
  readonly reader: DocumentTextReader;
  readonly receipts: ReceiptRegistry;
}

export interface PaymentProofStepInput {
  readonly tenantId: string;
  readonly resolve: VariableResolver;
  readonly now: Date;
  readonly timezone: string;
  /** El archivo ya en mano («Probar»). Si falta, se descarga de `config.source`. */
  readonly document?: DocumentInput;
  /**
   * Registrar el comprobante como usado. Ausente = solo consultar (prueba).
   */
  readonly claim?: { readonly conversationKey: string; readonly flowKey: string };
}

export type PaymentProofFailure =
  | "source_missing"
  | "download_failed"
  | "read_failed"
  | "invalid_expected_amount";

export interface PaymentProofStepResult {
  readonly output: ReceiptOutput;
  /** Explicación corta del resultado (va a la variable de error si no es válido). */
  readonly message: string;
  readonly failure?: PaymentProofFailure;
  readonly checks: ReadonlyArray<ReceiptCheck>;
  /** Datos leídos, con los nombres de `PAYMENT_PROOF_FIELDS`. */
  readonly fields: Partial<Record<PaymentProofField, string>>;
  /** Texto leído del documento (para «Probar»; no se guarda en la sesión). */
  readonly text?: string;
  readonly method?: DocumentTextMethod;
  readonly durationMs: number;
  readonly missingVariables: ReadonlyArray<string>;
}

/** Tope de la imagen o PDF descargado. WhatsApp manda imágenes de hasta 5 MB. */
export const RECEIPT_MAX_BYTES = 10 * 1024 * 1024;
const DOWNLOAD_TIMEOUT_MS = 15_000;

// --- Archivo -----------------------------------------------------------------

interface SourceRef {
  readonly url: string;
  readonly contentType?: string;
}

function asSource(value: unknown): SourceRef | undefined {
  if (typeof value === "string" && /^https?:\/\//i.test(value.trim())) return { url: value.trim() };
  if (typeof value === "object" && value !== null) {
    const record = value as Record<string, unknown>;
    const url = [record["url"], record["link"], record["mediaUrl"]].find((entry) => typeof entry === "string") as string | undefined;
    const type = [record["contentType"], record["mimeType"], record["mime_type"]].find((entry) => typeof entry === "string") as string | undefined;
    if (url && /^https?:\/\//i.test(url)) return { url, ...(type ? { contentType: type } : {}) };
  }
  return undefined;
}

/**
 * La variable del bloque puede guardar la URL o el archivo como objeto
 * (`{ url, contentType }`, como lo guarda «Esperar respuesta» al recibir media).
 */
function resolveSource(template: string, resolve: VariableResolver, missing: Set<string>): SourceRef | undefined {
  const single = /^\{([A-Za-z_][A-Za-z0-9_.]{0,63})\}$/.exec(template.trim());
  if (single) {
    const value = resolve(single[1]!);
    if (value === undefined || value === null || value === "") missing.add(single[1]!);
    return asSource(value);
  }
  const rendered = renderTemplate(template, resolve, "url");
  rendered.missing.forEach((name) => missing.add(name));
  return asSource(rendered.text);
}

/** El tipo real por la firma del archivo (el declarado a veces miente). */
export function detectDocumentType(bytes: Uint8Array, declared = ""): string {
  const starts = (...signature: number[]) => signature.every((byte, index) => bytes[index] === byte);
  if (starts(0xff, 0xd8, 0xff)) return "image/jpeg";
  if (starts(0x89, 0x50, 0x4e, 0x47)) return "image/png";
  if (starts(0x25, 0x50, 0x44, 0x46)) return "application/pdf";
  if (starts(0x52, 0x49, 0x46, 0x46) && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return "image/webp";
  if (starts(0x47, 0x49, 0x46)) return "image/gif";
  if (starts(0x42, 0x4d)) return "image/bmp";
  return declared.split(";")[0]!.trim().toLowerCase();
}

// --- Datos de salida -----------------------------------------------------------

function fieldsOf(facts: ReceiptFacts, verification: ReceiptVerification, currency: string): Partial<Record<PaymentProofField, string>> {
  const fields: Partial<Record<PaymentProofField, string>> = {};
  if (facts.amount !== undefined) fields.valor = String(facts.amount);
  fields.moneda = facts.currency ?? currency;
  if (facts.date) fields.fecha = facts.date.local;
  if (verification.bank) fields.banco = verification.bank;
  if (verification.account) fields.cuenta_destino = verification.account.number;
  if (verification.holder) fields.titular_destino = verification.holder;
  if (facts.payer) fields.nombre_pagador = facts.payer;
  if (facts.reference) fields.referencia = facts.reference;
  return fields;
}

/**
 * Huella del comprobante: su referencia; si no la trae, valor + fecha y hora
 * + cuenta; y si tampoco, el texto completo (la misma imagen reenviada).
 */
export function receiptFingerprint(facts: ReceiptFacts, verification: ReceiptVerification): string {
  if (facts.reference) return `ref:${facts.reference}`;
  const hash = (text: string) => createHash("sha256").update(text).digest("hex").slice(0, 40);
  if (facts.amount !== undefined && facts.date?.hasTime) {
    return `data:${hash(`${facts.amount}|${facts.date.instant.toISOString()}|${verification.account?.id ?? ""}`)}`;
  }
  return `text:${hash(facts.folded.replace(/\s+/g, " "))}`;
}

const MESSAGES: Readonly<Record<ReceiptOutput, string>> = {
  valid: "Comprobante válido.",
  "wrong-key": "El pago no llegó a ninguna de las cuentas registradas.",
  "wrong-recipient": "El titular del destino no coincide.",
  "wrong-amount": "El valor pagado no es el esperado.",
  "too-old": "El comprobante no es reciente.",
  duplicate: "Este comprobante ya se había usado.",
  invalid: "El archivo no es un comprobante de pago legible.",
  failure: "No se pudo revisar el comprobante."
};

// --- Ejecución ----------------------------------------------------------------

export async function runPaymentProofStep(
  config: PaymentProofConfig,
  input: PaymentProofStepInput,
  ports: PaymentProofPorts,
  clock: () => number = Date.now
): Promise<PaymentProofStepResult> {
  const started = clock();
  const missing = new Set<string>();
  const O = PAYMENT_PROOF_OUTPUT;
  const finish = (result: Omit<PaymentProofStepResult, "durationMs" | "missingVariables">): PaymentProofStepResult => ({
    ...result,
    durationMs: clock() - started,
    missingVariables: [...missing]
  });
  const fail = (output: ReceiptOutput, failure: PaymentProofFailure | undefined, message: string, extra: Partial<PaymentProofStepResult> = {}) =>
    finish({ output, message, ...(failure ? { failure } : {}), checks: [], fields: {}, ...extra });

  // 1. El monto esperado (puede venir de una variable: el precio del producto).
  let expectedAmount: number | undefined;
  if (config.amountCheck !== "off") {
    const rendered = renderTemplate(config.expectedAmount, input.resolve);
    rendered.missing.forEach((name) => missing.add(name));
    expectedAmount = parseAmount(rendered.text.trim()) ?? undefined;
    if (expectedAmount === undefined) {
      return fail(O.failure, "invalid_expected_amount", `El monto esperado no es un número válido: «${rendered.text.trim().slice(0, 40) || "vacío"}».`);
    }
  }

  // 2. El archivo.
  let document = input.document;
  if (!document) {
    const source = resolveSource(config.source, input.resolve, missing);
    if (!source) return fail(O.failure, "source_missing", "No llegó ningún archivo en la variable del comprobante.");
    const fetched = await ports.fetcher.fetch({ url: source.url, maxBytes: RECEIPT_MAX_BYTES, timeoutMs: DOWNLOAD_TIMEOUT_MS });
    if (!fetched.ok) return fail(O.failure, "download_failed", `No se pudo descargar el comprobante: ${fetched.message}`);
    document = { bytes: fetched.media.bytes, contentType: source.contentType ?? fetched.media.contentType };
  }
  document = { bytes: document.bytes, contentType: detectDocumentType(document.bytes, document.contentType) };

  // 3. El texto.
  const read = await ports.reader.read(document);
  if (!read.ok) {
    // Un audio, un sticker o una foto sin texto no son comprobantes: salida propia.
    const notReceipt = read.reason === "unsupported_type" || read.reason === "unreadable";
    return fail(notReceipt ? O.invalid : O.failure, notReceipt ? undefined : "read_failed", read.message);
  }

  // 4. Datos y verificación.
  const facts = extractReceipt(read.text, input.timezone);
  const verification = verifyReceipt(config, facts, { ...(expectedAmount !== undefined ? { expectedAmount } : {}), now: input.now });
  const fields = fieldsOf(facts, verification, config.amountCurrency);
  const base = { checks: verification.checks, fields, text: facts.text, method: read.method };

  if (verification.output !== O.valid) {
    const failed = verification.checks.find((check) => !check.passed);
    return finish({ output: verification.output, message: failed?.detail ?? MESSAGES[verification.output], ...base });
  }

  // 5. ¿Repetido? Solo cuando todo lo demás pasó: un comprobante rechazado no se gasta.
  const fingerprint = receiptFingerprint(facts, verification);
  const claim = input.claim;
  const outcome = claim
    ? await ports.receipts.claim(input.tenantId, {
        fingerprint,
        conversationKey: claim.conversationKey,
        flowKey: claim.flowKey,
        ...(facts.reference ? { reference: facts.reference } : {}),
        ...(facts.amount !== undefined ? { amount: facts.amount, currency: fields.moneda ?? config.amountCurrency } : {})
      })
    : (await ports.receipts.exists(input.tenantId, fingerprint))
      ? "duplicate"
      : "new";

  if (config.rejectDuplicates) {
    const duplicate = outcome === "duplicate";
    const checks = [
      ...verification.checks,
      {
        id: "duplicate" as const,
        passed: !duplicate,
        detail: duplicate
          ? `Este comprobante${facts.reference ? ` (referencia ${facts.reference})` : ""} ya se había usado.`
          : "Es la primera vez que llega este comprobante."
      }
    ];
    if (duplicate) return finish({ output: O.duplicate, message: checks[checks.length - 1]!.detail, ...base, checks });
    return finish({ output: O.valid, message: validMessage(facts, config), ...base, checks });
  }

  return finish({ output: O.valid, message: validMessage(facts, config), ...base });
}

function validMessage(facts: ReceiptFacts, config: PaymentProofConfig): string {
  return facts.amount !== undefined
    ? `Comprobante válido por ${formatAmount(facts.amount, facts.currency ?? config.amountCurrency)}.`
    : MESSAGES.valid;
}
