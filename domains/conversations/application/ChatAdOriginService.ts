import type { AdOrigin } from "../../../contracts/AdOrigin";
import type { ChatAdOrigin, ChatAdResponse } from "../../../contracts/ChatAdContracts";
import { NotFoundError } from "../../../platform/observability/errors/NotFoundError";

// ---------------------------------------------------------------------------
// De qué anuncio llegó el cliente de un chat. Junta lo que trajo WhatsApp (en
// la ficha del contacto) con lo que se sabe del anuncio en las cuentas de Meta
// conectadas (nombre, campaña, estado). Los datos del mensaje NO son de fiar
// (un cliente con una app modificada puede inventarlos): solo pasan enlaces
// `https://` y se dice si el anuncio es de una cuenta conectada.
// ---------------------------------------------------------------------------

/** Lo que se sabe del anuncio en las cuentas conectadas. */
export interface KnownAd {
  readonly name: string;
  readonly campaignName: string | null;
  readonly status: string | null;
  readonly thumbnailUrl: string | null;
}

export interface ChatAdLookup {
  /** El anuncio guardado en la ficha del cliente (`null` si no llegó por uno). */
  readonly origin: AdOrigin | null;
  /** El anuncio en las cuentas conectadas (`null` si no está). */
  readonly known: KnownAd | null;
}

export interface ChatAdOriginReader {
  /** `null` si el chat no existe o es de otra cuenta. */
  find(tenantId: string, conversationId: string): Promise<ChatAdLookup | null>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TEXT_MAX = 600;

/** Un enlace que se puede abrir: solo `https://` y bien formado. */
export function safeUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

const shortText = (value: string | null | undefined) => {
  const text = value?.replace(/\s+/g, " ").trim();
  return text ? (text.length > TEXT_MAX ? `${text.slice(0, TEXT_MAX - 1)}…` : text) : null;
};

export function chatAdOf(lookup: ChatAdLookup): ChatAdOrigin | null {
  const { origin, known } = lookup;
  if (!origin) return null;
  return {
    sourceId: origin.sourceId,
    title: shortText(origin.title),
    body: shortText(origin.body),
    // La miniatura de la cuenta conectada es la oficial; si no, la que trajo el mensaje.
    thumbnailUrl: safeUrl(known?.thumbnailUrl) ?? safeUrl(origin.thumbnailUrl),
    sourceUrl: safeUrl(origin.sourceUrl),
    mediaUrl: safeUrl(origin.mediaUrl),
    receivedAt: origin.receivedAt ?? null,
    connected: known !== null,
    adName: known?.name ?? null,
    campaignName: known?.campaignName ?? null,
    adStatus: known?.status ?? null
  };
}

export class ChatAdOriginService {
  public constructor(private readonly reader: ChatAdOriginReader) {}

  public async get(tenantId: string, conversationId: string): Promise<ChatAdResponse> {
    const lookup = UUID.test(conversationId) ? await this.reader.find(tenantId, conversationId) : null;
    if (!lookup) throw new NotFoundError("Ese chat no existe.");
    return { ad: chatAdOf(lookup) };
  }
}
