import { readBoolean, readEnum, readInteger, readItems, readString, readStringList } from "./ConfigReaders";
import { COUNTRY_CODES_ISO, CURRENCY_CODES, DEFAULT_COUNTRY, findCountry } from "./Countries";
import { accountTypesFor, defaultAccountType, normalizeProviderId, providersFor } from "./PaymentProviders";

// ---------------------------------------------------------------------------
// Comprobante automático — contrato de configuración compartido por el builder
// (editor) y el motor (PaymentProofNodeHandler).
//
// El bloque lee la imagen o PDF del pago (OCR propio, sin IA), extrae sus datos
// y los contrasta con las CUENTAS DE RECAUDO del negocio (entidad, número o
// llave, titular y sus variantes). Cada verificación activa abre una salida.
// ---------------------------------------------------------------------------

/** Una cuenta donde el negocio recibe pagos. */
export interface PaymentAccount {
  readonly id: string;
  /** País de la cuenta (ISO alfa-2): decide entidades, tipos y documento. */
  readonly country: string;
  /** Id de entidad de `providersFor(country)`. */
  readonly provider: string;
  /** Id de tipo de `accountTypesFor(country)` (CLABE, CBU, Chave PIX…). */
  readonly accountType: string;
  /** Número de cuenta, celular o llave, tal como aparece en el comprobante. */
  readonly number: string;
  /** Titular, tal como aparece en el comprobante. */
  readonly holder: string;
  /** Otras formas en que aparece el titular («AUREAM S.A.S», «Auream SAS»). */
  readonly holderAliases: ReadonlyArray<string>;
  /** Documento fiscal o de identidad del titular (opcional). */
  readonly holderDocument: string;
  /** Nombre interno para reconocerla («Cuenta principal»). */
  readonly alias: string;
}

export type AmountCheck = "off" | "exact" | "minimum";

export interface PaymentProofConfig {
  /** Variable con el archivo del comprobante. */
  readonly source: string;
  readonly accounts: ReadonlyArray<PaymentAccount>;
  /** El destino del pago debe ser una de las cuentas (entidad + número/llave). */
  readonly matchAccount: boolean;
  /** El titular del destino debe coincidir con el de esa cuenta (o un alias). */
  readonly matchHolder: boolean;
  readonly amountCheck: AmountCheck;
  /** Monto esperado; admite variables (p. ej. el precio del producto). */
  readonly expectedAmount: string;
  readonly amountCurrency: string;
  readonly maxAgeEnabled: boolean;
  /** Antigüedad máxima del pago, en horas. */
  readonly maxAgeHours: number;
  /** Rechazar comprobantes cuya referencia ya se usó antes. */
  readonly rejectDuplicates: boolean;
  readonly resultVariable: string;
  readonly errorVariable: string;
}

export const MAX_AGE_LIMIT_HOURS = 720;

export const PAYMENT_PROOF_DEFAULT_CONFIG: PaymentProofConfig = {
  source: "{comprobante}",
  accounts: [],
  matchAccount: true,
  matchHolder: true,
  amountCheck: "off",
  expectedAmount: "",
  amountCurrency: "COP",
  maxAgeEnabled: false,
  maxAgeHours: 24,
  rejectDuplicates: true,
  resultVariable: "comprobante",
  errorVariable: "comprobante.error"
};

/** Cuenta nueva de un país, con su primera entidad y el tipo habitual de esta. */
export function createAccount(id: string, country = DEFAULT_COUNTRY, provider?: string): PaymentAccount {
  const providerId = provider ?? providersFor(country)[0].id;
  return {
    id,
    country,
    provider: providerId,
    accountType: defaultAccountType(country, providerId),
    number: "",
    holder: "",
    holderAliases: [],
    holderDocument: "",
    alias: ""
  };
}

export function readPaymentProofConfig(config: Readonly<Record<string, unknown>>): PaymentProofConfig {
  const d = PAYMENT_PROOF_DEFAULT_CONFIG;

  let accounts = readItems(config["accounts"], "acc", (record, id): PaymentAccount => {
    const country = readEnum(record["country"], COUNTRY_CODES_ISO, DEFAULT_COUNTRY);
    const provider = normalizeProviderId(country, readString(record["provider"]));
    const types = accountTypesFor(country).map((type) => type.id);
    return {
      id,
      country,
      provider,
      accountType: readEnum(record["accountType"], types, defaultAccountType(country, provider)),
      number: readString(record["number"]).trim(),
      holder: readString(record["holder"]),
      holderAliases: readStringList(record["holderAliases"]),
      holderDocument: readString(record["holderDocument"]).trim(),
      alias: readString(record["alias"])
    };
  });

  // Modelo anterior: una sola cuenta/llave y un titular sueltos.
  const legacyKey = readString(config["expectedKey"]).trim();
  const legacyHolder = readString(config["expectedRecipient"]).trim();
  if (accounts.length === 0 && (legacyKey || legacyHolder)) {
    accounts = [{ ...createAccount("acc-1", DEFAULT_COUNTRY, "other"), number: legacyKey, holder: legacyHolder }];
  }

  return {
    source: readString(config["source"], d.source).trim(),
    accounts,
    matchAccount: readBoolean(config["matchAccount"], readBoolean(config["validateKey"], d.matchAccount)),
    matchHolder: readBoolean(config["matchHolder"], readBoolean(config["validateRecipient"], d.matchHolder)),
    amountCheck: readEnum(config["amountCheck"], ["off", "exact", "minimum"] as const, d.amountCheck),
    expectedAmount: readString(config["expectedAmount"]),
    amountCurrency: readEnum(
      config["amountCurrency"],
      CURRENCY_CODES,
      findCountry(accounts[0]?.country ?? DEFAULT_COUNTRY).currency
    ),
    maxAgeEnabled: readBoolean(config["maxAgeEnabled"]),
    maxAgeHours: readInteger(config["maxAgeHours"], d.maxAgeHours, 1, MAX_AGE_LIMIT_HOURS),
    rejectDuplicates: readBoolean(config["rejectDuplicates"], d.rejectDuplicates),
    resultVariable: readString(config["resultVariable"], d.resultVariable).trim(),
    errorVariable: readString(config["errorVariable"], d.errorVariable).trim()
  };
}

/** Ids persistidos. `wrong-key` y `wrong-recipient` se conservan del modelo anterior. */
export const PAYMENT_PROOF_OUTPUT = {
  valid: "valid",
  wrongAccount: "wrong-key",
  wrongHolder: "wrong-recipient",
  wrongAmount: "wrong-amount",
  tooOld: "too-old",
  duplicate: "duplicate",
  invalid: "invalid",
  failure: "failure"
} as const;

/** Datos que quedan disponibles tras leer el comprobante. */
export const PAYMENT_PROOF_FIELDS = [
  "valor",
  "moneda",
  "fecha",
  "banco",
  "cuenta_destino",
  "titular_destino",
  "nombre_pagador",
  "referencia"
] as const;

export type PaymentProofField = (typeof PAYMENT_PROOF_FIELDS)[number];
