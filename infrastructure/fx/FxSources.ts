// ---------------------------------------------------------------------------
// De dónde salen las tasas de cambio oficiales (unidades de cada moneda por
// 1 USD). Cada fuente dice qué monedas trae; Auream usa, para cada moneda, la
// primera fuente de la lista que la tenga:
//
//   bcv          el bolívar (VES) oficial del Banco Central de Venezuela, por
//                DolarApi (ve.dolarapi.com, fuente «oficial»). La página del
//                BCV tiene un certificado inválido: no se lee directo.
//   open-er-api  las demás (COP, MXN, PEN, EUR…), de open.er-api.com. Su VES
//                coincide con el del BCV y sirve de respaldo.
//
// Ninguna inventa: sin respuesta válida, la fuente no trae nada y se usa la
// siguiente o la última tasa guardada.
// ---------------------------------------------------------------------------

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface FxQuote {
  /** Unidades de la moneda por 1 USD. */
  readonly perUsd: number;
}

export interface FxSource {
  /** Nombre corto que se guarda con la tasa y se muestra («bcv», «open-er-api»). */
  readonly name: string;
  /** Las tasas de hoy que trae (por código ISO). Lanza si la fuente no responde bien. */
  fetch(): Promise<Readonly<Record<string, FxQuote>>>;
}

const TIMEOUT_MS = 8_000;
const valid = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value > 0;

export class OpenErApiSource implements FxSource {
  public readonly name = "open-er-api";

  public constructor(private readonly fetchImpl: FetchLike, private readonly codes: ReadonlyArray<string>) {}

  public async fetch(): Promise<Readonly<Record<string, FxQuote>>> {
    const response = await this.fetchImpl("https://open.er-api.com/v6/latest/USD", { signal: AbortSignal.timeout(TIMEOUT_MS) });
    const body = (await response.json()) as { result?: string; rates?: Record<string, unknown> };
    if (!response.ok || body.result !== "success" || !body.rates) throw new Error("open.er-api no devolvió tasas.");
    const quotes: Record<string, FxQuote> = {};
    for (const code of this.codes) {
      const value = body.rates[code];
      if (valid(value)) quotes[code] = { perUsd: value };
    }
    return quotes;
  }
}

/** Días que puede tener la tasa del BCV (fines de semana y feriados no publica). */
const BCV_MAX_AGE_DAYS = 5;

export class BcvOfficialSource implements FxSource {
  public readonly name = "bcv";

  public constructor(private readonly fetchImpl: FetchLike, private readonly now: () => Date = () => new Date()) {}

  public async fetch(): Promise<Readonly<Record<string, FxQuote>>> {
    const response = await this.fetchImpl("https://ve.dolarapi.com/v1/dolares/oficial", { signal: AbortSignal.timeout(TIMEOUT_MS) });
    const body = (await response.json()) as { fuente?: string; moneda?: string; promedio?: unknown; fechaActualizacion?: string };
    if (!response.ok || body.fuente !== "oficial" || body.moneda !== "USD" || !valid(body.promedio)) throw new Error("La tasa oficial del BCV no llegó.");
    const published = Date.parse(body.fechaActualizacion ?? "");
    if (!Number.isFinite(published) || this.now().getTime() - published > BCV_MAX_AGE_DAYS * 86_400_000) throw new Error("La tasa del BCV está vieja.");
    return { VES: { perUsd: body.promedio } };
  }
}

/** Las fuentes de Auream, en orden de preferencia por moneda (el bolívar, del BCV primero). */
export function officialSources(fetchImpl: FetchLike, codes: ReadonlyArray<string>, now?: () => Date): FxSource[] {
  return [new BcvOfficialSource(fetchImpl, now), new OpenErApiSource(fetchImpl, codes)];
}
