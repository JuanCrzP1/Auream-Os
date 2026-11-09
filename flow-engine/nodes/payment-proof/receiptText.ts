// ---------------------------------------------------------------------------
// Herramientas de texto para leer comprobantes. Puras.
//
// El texto llega del OCR: con tildes o sin ellas, mayúsculas al azar y los
// asteriscos de las cuentas enmascaradas («*****4567») convertidos a veces en
// comillas. Todo se compara sobre una versión «plegada» (minúsculas, sin
// tildes) que conserva la LONGITUD del original: así una posición encontrada
// en el texto plegado sirve para recortar el original con su escritura.
// ---------------------------------------------------------------------------

/** Caracteres con que los bancos (o el OCR) tapan dígitos y letras. */
export const MASK_CHARS = "*•·\"“”'’´`°";
const MASK_CLASS = "[*•·\"“”'’´`°]";

/** Minúsculas y sin tildes, carácter a carácter (misma longitud). */
export function fold(text: string): string {
  return text
    .split("")
    .map((char) => {
      const base = char.normalize("NFD").charAt(0);
      const lower = base.toLowerCase();
      return lower.length === 1 ? lower : base;
    })
    .join("");
}

export interface ReceiptLine {
  /** Tal como lo leyó el OCR (sin espacios sobrantes). */
  readonly original: string;
  /** Plegado: minúsculas y sin tildes, misma longitud que `original`. */
  readonly folded: string;
}

export function receiptLines(text: string): ReceiptLine[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line.length > 0)
    .map((original) => ({ original, folded: fold(original) }));
}

export function digitsOnly(text: string): string {
  return text.replace(/\D/g, "");
}

/** Sin espacios: para comparar llaves, correos y alias («@aureamsas»). */
export function compactKey(text: string): string {
  return fold(text).replace(/\s+/g, "");
}

// --- Nombres -----------------------------------------------------------------

/** Palabras que no distinguen a un titular: forma societaria y conectores. */
const NAME_FILLERS = new Set([
  "sas", "sa", "s", "a", "ltda", "ltd", "sac", "saa", "srl", "sl", "spa", "eirl", "eireli", "inc", "llc", "corp", "cia",
  "me", "mei", "sapi", "cv", "rl", "y", "e", "de", "del", "la", "las", "los", "el", "da", "do", "dos", "das"
]);

/** Palabras de un nombre: «AUREAM S.A.S.» → [«auream», «sas»]. */
export function nameWords(name: string): string[] {
  return fold(name)
    .replace(/[.,]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 0);
}

/** Palabras que identifican al titular (sin forma societaria ni conectores). */
export function significantWords(name: string): string[] {
  const words = nameWords(name);
  const significant = words.filter((word) => !NAME_FILLERS.has(word));
  return significant.length > 0 ? significant : words;
}

export interface TextWord {
  readonly value: string;
  /** Termina en asteriscos («Lau***»): solo se ve el comienzo. */
  readonly masked: boolean;
}

/** Palabras del comprobante, marcando las enmascaradas. */
export function textWords(foldedText: string): TextWord[] {
  const words: TextWord[] = [];
  const pattern = new RegExp(`[a-z0-9]+(?:${MASK_CLASS}+)?`, "g");
  // «s.a.s.» → «sas.»: las siglas con puntos cuentan como una palabra.
  const cleaned = foldedText.replace(/([a-z])\.(?=[a-z])/g, "$1");
  for (const match of cleaned.matchAll(pattern)) {
    const raw = match[0];
    const value = raw.replace(new RegExp(`${MASK_CLASS}+$`), "");
    words.push({ value, masked: value.length < raw.length });
  }
  return words;
}

/** Distancia de edición ≤ 1 (una letra cambiada, de más o de menos). */
export function withinOneEdit(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else {
      i++;
      j++;
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

/** ¿La palabra del titular aparece en el comprobante (con tolerancia al OCR)? */
function wordAppears(word: string, words: ReadonlyArray<TextWord>): boolean {
  return words.some((candidate) => {
    if (candidate.masked) return candidate.value.length >= 3 && word.startsWith(candidate.value);
    if (candidate.value === word) return true;
    return word.length >= 5 && withinOneEdit(candidate.value, word);
  });
}

/**
 * ¿El nombre aparece en el comprobante? Deben verse sus palabras
 * significativas: todas si son 1 o 2; si son más, al menos el 60 % (los
 * bancos suelen mostrar solo nombre y primer apellido).
 */
export function nameAppears(name: string, words: ReadonlyArray<TextWord>): boolean {
  const wanted = significantWords(name);
  if (wanted.length === 0) return false;
  const needed = wanted.length <= 2 ? wanted.length : Math.ceil(wanted.length * 0.6);
  return wanted.filter((word) => wordAppears(word, words)).length >= needed;
}

/** ¿Las palabras distintivas del nombre de una entidad aparecen como palabras? */
export function mentions(foldedText: string, name: string): boolean {
  const words = nameWords(name).filter((word) => word !== "banco" && !NAME_FILLERS.has(word));
  if (words.length === 0) return false;
  return words.every((word) => new RegExp(`(?:^|[^a-z0-9])${word}(?:$|[^a-z0-9])`).test(foldedText));
}

export const MASKED_DIGITS = new RegExp(
  `(?:${MASK_CLASS}+|(?:^|[^a-z0-9])x{2,}|termina(?:da|do)?\\s+en|finalizad[ao]\\s+en)\\s*(\\d{3,6})(?!\\d)`,
  "g"
);
