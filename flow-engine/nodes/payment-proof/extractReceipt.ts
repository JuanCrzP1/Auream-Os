import { parseAmount } from "../../values/parseAmount";
import { isRealDate, zonedToInstant } from "../../values/zonedTime";
import { fold, receiptLines, type ReceiptLine } from "./receiptText";

// ---------------------------------------------------------------------------
// Del texto de un comprobante a sus datos: valor, moneda, fecha, referencia y
// quién pagó. Pura y sin IA: reglas sobre cómo escriben los comprobantes los
// bancos y billeteras de Latinoamérica.
//
// No decide si el comprobante es válido (eso es `verifyReceipt`): solo dice
// lo que encontró. Lo que no encuentra queda ausente, nunca inventado.
// ---------------------------------------------------------------------------

export interface ReceiptDate {
  readonly instant: Date;
  /** El comprobante trae la hora; si no, se toma el final de ese día. */
  readonly hasTime: boolean;
  /** Tal como aparece («8 nov 2026, 10:35 a. m.»). */
  readonly text: string;
  /** En la hora del negocio, legible y ordenable: «2026-11-08 10:35». */
  readonly local: string;
}

export interface ReceiptFacts {
  readonly text: string;
  readonly lines: ReadonlyArray<ReceiptLine>;
  readonly folded: string;
  readonly amount?: number;
  /** Solo si el comprobante la dice explícitamente (US$, R$, MXN…). «$» es ambiguo. */
  readonly currency?: string;
  readonly date?: ReceiptDate;
  readonly reference?: string;
  readonly payer?: string;
  /** Tiene palabras de comprobante (transferencia, pago, envío…). */
  readonly hasReceiptWords: boolean;
}

// --- Valor -------------------------------------------------------------------

const AMOUNT_WORDS = /\b(valor|monto|total|importe|cantidad|pagaste|enviaste|transferiste|recibiste|pagado|enviado|transferido|pago de|abono|deposito|valor del pago|quantia|valor pago)\b/;
const NOT_AMOUNT_WORDS = /\b(cuenta|celular|telefono|movil|ref|referencia|nit|cc|cedula|documento|fecha|hora|numero|nro|no\.|aprobacion|autorizacion|codigo|id|clabe|cbu|cvu|rut|ruc|dni|cpf|cnpj|rfc|llave|chave|operacion|transaccion|comprobante|folio|rastreo)\b/;

const CURRENCY_TOKEN = String.raw`us\$|r\$|s\/\.?|bs\.?|€|\$|\b(?:cop|usd|mxn|pen|clp|ars|brl|bob|pyg|uyu|crc|gtq|dop|ves|eur)\b`;
const NUMBER_TOKEN = String.raw`\d{1,3}(?:[., ]\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?`;
const MONEY = new RegExp(String.raw`(${CURRENCY_TOKEN})?\s?(${NUMBER_TOKEN})(?:\s?(${CURRENCY_TOKEN}))?`, "g");

const CURRENCY_OF: Readonly<Record<string, string>> = {
  "us$": "USD",
  "r$": "BRL",
  "s/": "PEN",
  "s/.": "PEN",
  "€": "EUR"
};

function currencyOf(token: string | undefined): string | undefined {
  if (!token) return undefined;
  const clean = token.trim();
  if (CURRENCY_OF[clean]) return CURRENCY_OF[clean];
  return /^[a-z]{3}$/.test(clean) ? clean.toUpperCase() : undefined;
}

interface AmountCandidate {
  readonly value: number;
  readonly currency?: string;
  readonly score: number;
  readonly order: number;
}

function amountCandidates(lines: ReadonlyArray<ReceiptLine>): AmountCandidate[] {
  const candidates: AmountCandidate[] = [];
  lines.forEach((line, index) => {
    const text = line.folded;
    const previous = index > 0 ? lines[index - 1]!.folded : "";
    for (const match of text.matchAll(MONEY)) {
      const [whole, before, number, after] = match;
      const start = match.index ?? 0;
      const end = start + whole.length;
      // Partes de fechas, horas o códigos («08/11/2026», «10:35», «M8743219»).
      if (/[/:\-]/.test(text.charAt(start - 1)) || /[/:\-]/.test(text.charAt(end)) || /[a-z]/.test(text.charAt(start - 1))) continue;
      if (/[a-z]/.test(text.charAt(end)) && !after) continue;

      const marker = before ?? after;
      const value = parseAmount(number!.replace(/ /g, ""));
      if (value === null) continue;
      const bareDigits = /^\d+$/.test(number!);
      if (!marker && bareDigits && number!.length >= 7) continue;

      let score = 0;
      if (marker) score += 3;
      if (AMOUNT_WORDS.test(text)) score += 3;
      else if (AMOUNT_WORDS.test(previous) && text.length <= 24) score += 2;
      if (!marker && NOT_AMOUNT_WORDS.test(text)) score -= 5;
      if (score < 3) continue;

      // «$1,250.50 MXN»: el código explícito manda sobre el «$» ambiguo.
      const currency = currencyOf(after) ?? currencyOf(before);
      candidates.push({ value, ...(currency ? { currency } : {}), score, order: candidates.length });
    }
  });
  return candidates;
}

// --- Fecha -------------------------------------------------------------------

const MONTHS: Readonly<Record<string, number>> = {
  ene: 1, jan: 1, feb: 2, fev: 2, mar: 3, abr: 4, apr: 4, may: 5, mai: 5, jun: 6, jul: 7,
  ago: 8, aug: 8, sep: 9, set: 9, oct: 10, out: 10, nov: 11, dic: 12, dec: 12, dez: 12
};

const NAMED_DATE = /(\d{1,2})\s*(?:de\s+)?([a-z]{3,10})\.?,?\s*(?:de\s+|del\s+)?(\d{4})/g;
const NUMERIC_DMY = /(?<!\d)(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}|\d{2})(?!\d)/g;
const NUMERIC_YMD = /(?<!\d)(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})(?!\d)/g;
const TIME = /(?<!\d)(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(a\.?\s?m\.?|p\.?\s?m\.?)?/;

interface FoundDay {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly start: number;
  readonly end: number;
}

function findDay(text: string): FoundDay | undefined {
  const found: FoundDay[] = [];
  for (const match of text.matchAll(NAMED_DATE)) {
    const month = MONTHS[match[2]!.slice(0, 3)];
    if (month) found.push({ day: Number(match[1]), month, year: Number(match[3]), start: match.index!, end: match.index! + match[0].length });
  }
  for (const match of text.matchAll(NUMERIC_YMD)) {
    found.push({ year: Number(match[1]), month: Number(match[2]), day: Number(match[3]), start: match.index!, end: match.index! + match[0].length });
  }
  for (const match of text.matchAll(NUMERIC_DMY)) {
    let day = Number(match[1]);
    let month = Number(match[2]);
    if (month > 12 && day <= 12) [day, month] = [month, day];
    const year = match[3]!.length === 2 ? 2000 + Number(match[3]) : Number(match[3]);
    found.push({ day, month, year, start: match.index!, end: match.index! + match[0].length });
  }
  return found
    .filter((date) => date.year >= 2000 && date.year <= 2100 && isRealDate(date.year, date.month, date.day))
    .sort((a, b) => a.start - b.start)[0];
}

function findDate(original: string, folded: string, timezone: string): ReceiptDate | undefined {
  const day = findDay(folded);
  if (!day) return undefined;

  // La hora: justo después de la fecha; si no, la primera del comprobante.
  const near = folded.slice(day.end, day.end + 30);
  const time = TIME.exec(near) ?? TIME.exec(folded);
  let hour = 23;
  let minute = 59;
  let second = 59;
  let text = original.slice(day.start, day.end);

  if (time) {
    hour = Number(time[1]);
    minute = Number(time[2]);
    second = time[3] ? Number(time[3]) : 0;
    const meridiem = time[4]?.replace(/[\s.]/g, "");
    if (meridiem === "pm" && hour < 12) hour += 12;
    if (meridiem === "am" && hour === 12) hour = 0;
    if (hour > 23 || minute > 59 || second > 59) return undefined;
    if (time.input === near) text = original.slice(day.start, day.end + time.index + time[0].length).trim();
  }

  const pad = (value: number) => String(value).padStart(2, "0");
  const localDay = `${day.year}-${pad(day.month)}-${pad(day.day)}`;
  return {
    instant: zonedToInstant({ year: day.year, month: day.month, day: day.day, hour, minute, second }, timezone),
    hasTime: Boolean(time),
    text: text.replace(/[,\s]+$/, ""),
    local: time ? `${localDay} ${pad(hour)}:${pad(minute)}` : localDay
  };
}

// --- Referencia y pagador ------------------------------------------------------

const REFERENCE_LABEL = /\b(referencia|ref|comprobante|aprobacion|autorizacion|transaccion|operacion|codigo|cus|folio|rastreo|id|nro|numero de (?:operacion|transaccion|comprobante|aprobacion))\b/;
const REFERENCE_TOKEN = /(?<![a-z0-9])([a-z0-9][a-z0-9-]{4,39})(?![a-z0-9])/g;

function referenceIn(text: string): string | undefined {
  for (const match of text.matchAll(REFERENCE_TOKEN)) {
    const token = match[1]!;
    if (/\d/.test(token) && !/^\d{1,2}-\d{1,2}-\d{2,4}$/.test(token)) return token.toUpperCase();
  }
  return undefined;
}

function findReference(lines: ReadonlyArray<ReceiptLine>): string | undefined {
  for (let index = 0; index < lines.length; index++) {
    const label = REFERENCE_LABEL.exec(lines[index]!.folded);
    if (!label) continue;
    const rest = lines[index]!.folded.slice(label.index + label[0].length);
    const sameLine = referenceIn(rest);
    if (sameLine) return sameLine;
    const next = lines[index + 1]?.folded;
    if (next && !REFERENCE_LABEL.test(next)) {
      const nextLine = referenceIn(next);
      if (nextLine) return nextLine;
    }
  }
  return undefined;
}

const PAYER_LABEL = /^(?:de|desde|origen|ordenante|remitente|pagador|enviado por|pagado por|cliente|nombre del ordenante|cuenta origen de)\b[:\s]*/;

function cleanName(text: string): string | undefined {
  const name = text.replace(/[^\p{L}\s*.'-]/gu, " ").replace(/\s+/g, " ").trim();
  return /\p{L}{2}/u.test(name) && name.length <= 60 ? name : undefined;
}

function findPayer(lines: ReadonlyArray<ReceiptLine>): string | undefined {
  for (let index = 0; index < lines.length; index++) {
    const label = PAYER_LABEL.exec(lines[index]!.folded);
    if (!label) continue;
    const sameLine = cleanName(lines[index]!.original.slice(label[0].length));
    if (sameLine) return sameLine;
    const next = lines[index + 1];
    if (next && /^\D+$/.test(next.original)) return cleanName(next.original);
  }
  return undefined;
}

// --- Conjunto ----------------------------------------------------------------

const RECEIPT_WORDS = /\b(transferencia|transferiste|pago|pagaste|comprobante|enviaste|envio|recibo|transaccion|exitos[ao]|aprobad[ao]|deposito|consignacion|pix|recibiste|operacion|movimiento|constancia|voucher|bre-?b)\b/;

export function extractReceipt(text: string, timezone: string): ReceiptFacts {
  const lines = receiptLines(text);
  const original = lines.map((line) => line.original).join("\n");
  const folded = fold(original);

  const best = amountCandidates(lines).sort((a, b) => b.score - a.score || a.order - b.order)[0];
  const date = findDate(original, folded, timezone);
  const reference = findReference(lines);
  const payer = findPayer(lines);

  return {
    text: original,
    lines,
    folded,
    ...(best ? { amount: best.value } : {}),
    ...(best?.currency ? { currency: best.currency } : {}),
    ...(date ? { date } : {}),
    ...(reference ? { reference } : {}),
    ...(payer ? { payer } : {}),
    hasReceiptWords: RECEIPT_WORDS.test(folded)
  };
}
