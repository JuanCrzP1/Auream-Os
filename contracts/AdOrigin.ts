// ---------------------------------------------------------------------------
// El anuncio de clic a WhatsApp del que llegó un cliente, como lo guarda Leona
// (columnas «Anúncio»): con qué anuncio, a qué publicación lleva, su miniatura
// y el código de clic con que Meta atribuye la venta. Se guarda en la ficha
// del contacto (el último anuncio por el que entró) y se usa por dentro: las
// variables con los MISMOS nombres de Leona (`{source_url}`…), la
// Notificación y el Pixel (`{ctwa_clid}` atribuye la compra al anuncio).
// ---------------------------------------------------------------------------

export interface AdOrigin {
  /** `{source_id}`: id del anuncio en Meta. */
  readonly sourceId: string | null;
  /** `{source_url}`: enlace al anuncio (p. ej. https://fb.me/…). */
  readonly sourceUrl: string | null;
  /** `{media_url}`: la publicación, reel o video del anuncio. */
  readonly mediaUrl: string | null;
  /** `{thumbnail_url}`: miniatura del anuncio. */
  readonly thumbnailUrl: string | null;
  /** `{ctwa_clid}`: código de clic de Meta (atribución de conversiones). */
  readonly ctwaClid: string | null;
}

/** Variable → dato del anuncio. Los nombres son los de Leona. */
export const AD_VARIABLES: Readonly<Record<string, keyof AdOrigin>> = {
  source_id: "sourceId",
  source_url: "sourceUrl",
  media_url: "mediaUrl",
  thumbnail_url: "thumbnailUrl",
  ctwa_clid: "ctwaClid"
};

const MAX_LENGTH = 2048;

function clean(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const text = String(value).trim();
  return text.length > 0 && text.length <= MAX_LENGTH ? text : null;
}

/** Un anuncio con al menos un dato, o `null`. No confía en la entrada (aviso del proveedor, base). */
export function readAdOrigin(raw: unknown): AdOrigin | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  const ad: AdOrigin = {
    sourceId: clean(value["sourceId"]),
    sourceUrl: clean(value["sourceUrl"]),
    mediaUrl: clean(value["mediaUrl"]),
    thumbnailUrl: clean(value["thumbnailUrl"]),
    ctwaClid: clean(value["ctwaClid"])
  };
  return Object.values(ad).some((item) => item !== null) ? ad : null;
}

/** El valor de una variable de anuncio (`source_url`…), si existe. */
export function adVariable(ad: AdOrigin | null, name: string): string | undefined {
  const key = AD_VARIABLES[name];
  return ad && key ? (ad[key] ?? undefined) : undefined;
}
