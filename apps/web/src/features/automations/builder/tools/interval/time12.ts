// ---------------------------------------------------------------------------
// Reloj de 12 horas: tres piezas (hora, minuto, a. m./p. m.) para la persona,
// `HH:mm` de 24 h para el disco.
//
// No es un parser de texto libre: cada pieza tiene un dominio cerrado y el
// control rechaza en cada pulsación lo que no pertenece a él, así que lo
// imposible no se puede teclear. El contrato no cambia: se sigue guardando
// `HH:mm`. Puro, sin navegador.
// ---------------------------------------------------------------------------

export type Meridiem = "am" | "pm";

export interface Time12 {
  /** «01»–«12». */
  readonly hour: string;
  /** «00»–«59». */
  readonly minute: string;
  readonly meridiem: Meridiem;
}

const ONE_OR_TWO_DIGITS = /^\d{1,2}$/;
const TIME_24 = /^([01]\d|2[0-3]):([0-5]\d)$/;

const pad2 = (n: number) => String(n).padStart(2, "0");

/**
 * ¿Puede el campo de hora contener esto mientras se edita? Vacío sí (borrar
 * para reescribir); «0» sí (primer paso de «08»); «00» y > 12, no.
 */
export function acceptsHour(text: string): boolean {
  if (text === "") return true;
  if (!ONE_OR_TWO_DIGITS.test(text)) return false;
  if (text === "00") return false;

  return Number(text) <= 12;
}

/** ¿Puede el campo de minutos contener esto mientras se edita? (vacío o 0–59) */
export function acceptsMinute(text: string): boolean {
  if (text === "") return true;
  if (!ONE_OR_TWO_DIGITS.test(text)) return false;

  return Number(text) <= 59;
}

/** Hora completa y guardable. Editable ≠ guardable: «» y «0» se teclean pero no son horas. */
export function isCompleteHour(text: string): boolean {
  return acceptsHour(text) && text !== "" && Number(text) >= 1;
}

export function isCompleteMinute(text: string): boolean {
  return acceptsMinute(text) && text !== "";
}

/**
 * ¿Puede la hora crecer con otra cifra? Decide el autoavance preguntando al
 * dominio, no contando caracteres: «1» espera (10–12), «2» ya está terminada.
 */
export function canHourGrow(text: string): boolean {
  if (text.length >= 2) return false;

  for (let digit = 0; digit <= 9; digit += 1) {
    if (acceptsHour(`${text}${digit}`)) return true;
  }

  return false;
}

/** «8» → «08», solo si ya está completa (al salir del campo, nunca al teclear). */
export function normalizeHour(text: string): string {
  return isCompleteHour(text) ? pad2(Number(text)) : text;
}

export function normalizeMinute(text: string): string {
  return isCompleteMinute(text) ? pad2(Number(text)) : text;
}

/**
 * Tres piezas → `HH:mm`. Única frontera de la aritmética: 12 a. m. = «00»,
 * 12 p. m. = «12». `null` = «todavía no es una hora».
 */
export function to24Hour(hour: string, minute: string, meridiem: Meridiem): string | null {
  if (!isCompleteHour(hour) || !isCompleteMinute(minute)) return null;

  const h = Number(hour);
  const m = Number(minute);
  const h24 = meridiem === "am" ? (h === 12 ? 0 : h) : h === 12 ? 12 : h + 12;

  return `${pad2(h24)}:${pad2(m)}`;
}

/** `HH:mm` → tres piezas. El meridiano se deduce, no se guarda. */
export function from24Hour(hhmm: string): Time12 | null {
  const match = TIME_24.exec(hhmm);
  if (match === null) return null;

  const h24 = Number(match[1]);

  return {
    hour: pad2(h24 % 12 === 0 ? 12 : h24 % 12),
    minute: match[2],
    meridiem: h24 < 12 ? "am" : "pm"
  };
}

/** «02:45 p.m.» para texto corrido. `null` si lo guardado no es una hora. */
export function formatTime12(hhmm: string): string | null {
  const parts = from24Hour(hhmm);
  if (parts === null) return null;

  return `${parts.hour}:${parts.minute} ${parts.meridiem === "am" ? "a.m." : "p.m."}`;
}
