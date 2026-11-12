// ---------------------------------------------------------------------------
// El anuncio por el que llegó el cliente de un chat (`GET
// /conversations/:id/ad`): lo que trajo WhatsApp (título, texto, miniatura,
// enlaces) y, si es de las cuentas de Meta conectadas, su nombre, campaña y
// estado. Sin el código de clic (`ctwa_clid`): es de uso interno.
// ---------------------------------------------------------------------------

export interface ChatAdOrigin {
  /** Id del anuncio en Meta. */
  readonly sourceId: string | null;
  /** El título y el texto como los vio el cliente. */
  readonly title: string | null;
  readonly body: string | null;
  /** Solo `https://`: los datos del anuncio vienen en el mensaje y no se confía en ellos. */
  readonly thumbnailUrl: string | null;
  readonly sourceUrl: string | null;
  readonly mediaUrl: string | null;
  /** Cuándo llegó por este anuncio (`null` en los guardados antes de saberlo). */
  readonly receivedAt: string | null;
  /** El anuncio es de una cuenta de Meta conectada (si no, su nombre y campaña no se conocen). */
  readonly connected: boolean;
  readonly adName: string | null;
  readonly campaignName: string | null;
  /** Estado en Meta («ACTIVE», «PAUSED»…). */
  readonly adStatus: string | null;
}

export interface ChatAdResponse {
  /** `null`: el cliente no llegó por un anuncio. */
  readonly ad: ChatAdOrigin | null;
}
