import type { ScheduleWhen } from "@contracts/ScheduledMessageContracts";

// ---------------------------------------------------------------------------
// Fecha y hora «de pared» en la zona del NEGOCIO (la misma con la que el
// servidor las lee): el chat programa mensajes con ellas y Datos del negocio,
// sus cambios programados. Puro.
// ---------------------------------------------------------------------------

const DAY_MS = 86_400_000;
const pad = (value: number) => String(value).padStart(2, "0");

function partsIn(instant: Date, timeZone: string): Record<string, number> {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(instant);
  return Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, Number(part.value)]));
}

export interface Wall {
  readonly date: string;
  readonly time: string;
  /** 0 = domingo. */
  readonly weekday: number;
}

/** Fecha y hora de pared del negocio en ese instante. */
export function wallOf(instant: Date, timeZone: string): Wall {
  const p = partsIn(instant, timeZone);
  const date = `${p["year"]}-${pad(p["month"]!)}-${pad(p["day"]!)}`;
  return { date, time: `${pad(p["hour"]!)}:${pad(p["minute"]!)}`, weekday: new Date(`${date}T00:00:00Z`).getUTCDay() };
}

/** El instante en que el reloj del negocio marca `when` (como el servidor). */
export function instantOf(when: ScheduleWhen, timeZone: string): Date {
  const naive = Date.parse(`${when.date}T${when.time}:00Z`);
  const offset = (at: number) => {
    const p = partsIn(new Date(at), timeZone);
    return Date.UTC(p["year"]!, p["month"]! - 1, p["day"]!, p["hour"]!, p["minute"]!, p["second"]!) - Math.floor(at / 1000) * 1000;
  };
  const first = naive - offset(naive);
  return new Date(naive - offset(first));
}

export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

/** «Hora de Colombia» (el nombre del país en español); si el navegador no lo sabe, la ciudad de la zona. */
export function zoneLabel(timeZone: string): string {
  try {
    const name = new Intl.DateTimeFormat("es", { timeZone, timeZoneName: "longGeneric" }).formatToParts(new Date()).find((part) => part.type === "timeZoneName")?.value;
    // Donde no hay horario de verano, el navegador dice «hora estándar de…»: sobra el «estándar».
    const plain = name?.replace(/\s+estándar/i, "");
    if (plain && !/^GMT|^UTC/.test(plain)) return plain.charAt(0).toUpperCase() + plain.slice(1);
  } catch {
    // Zona que el navegador no conoce: abajo, la ciudad.
  }
  return `Hora de ${(timeZone.split("/").pop() ?? timeZone).replace(/_/g, " ")}`;
}
