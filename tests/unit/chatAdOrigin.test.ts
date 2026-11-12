import { describe, expect, it } from "vitest";
import { ChatAdOriginService, chatAdOf, safeUrl, type ChatAdLookup } from "../../domains/conversations/application/ChatAdOriginService.js";

// ---------------------------------------------------------------------------
// El anuncio de un chat: lo que trajo WhatsApp más lo que se sabe en las
// cuentas de Meta conectadas. Los datos del mensaje no son de fiar: solo
// enlaces https, sin el código de clic, y se dice si el anuncio es de una
// cuenta conectada.
// ---------------------------------------------------------------------------

const CHAT = "c0c0c0c0-0000-4000-8000-000000000001";
const ORIGIN = {
  sourceId: "120244", sourceUrl: "https://fb.me/abc", mediaUrl: "https://www.facebook.com/reel/1/", thumbnailUrl: "https://scontent.example/m.jpg",
  ctwaClid: "secreto", title: "Tu canción", body: "Regala una canción con su nombre", receivedAt: "2026-11-09T19:35:00.000Z"
};

describe("anuncio de origen del chat", () => {
  it("de una cuenta conectada: su nombre, campaña, estado y miniatura oficial; nunca el código de clic", () => {
    const ad = chatAdOf({ origin: ORIGIN, known: { name: "Video Colombia · Mamás", campaignName: "Video Colombia", status: "ACTIVE", thumbnailUrl: "https://meta.example/oficial.jpg" } })!;
    expect(ad).toEqual({
      sourceId: "120244", title: "Tu canción", body: "Regala una canción con su nombre", thumbnailUrl: "https://meta.example/oficial.jpg",
      sourceUrl: "https://fb.me/abc", mediaUrl: "https://www.facebook.com/reel/1/", receivedAt: "2026-11-09T19:35:00.000Z",
      connected: true, adName: "Video Colombia · Mamás", campaignName: "Video Colombia", adStatus: "ACTIVE"
    });
    expect(JSON.stringify(ad)).not.toContain("secreto");
  });

  it("de otra cuenta (o inventado): lo del mensaje, marcado como no conectado; enlaces que no son https se descartan", () => {
    const ad = chatAdOf({ origin: { ...ORIGIN, sourceUrl: "javascript:alert(1)", mediaUrl: "http://inseguro.example/x", thumbnailUrl: "data:image/png;base64,AAA" }, known: null })!;
    expect(ad).toMatchObject({ connected: false, adName: null, campaignName: null, adStatus: null, sourceUrl: null, mediaUrl: null, thumbnailUrl: null, title: "Tu canción" });
  });

  it("textos largos se recortan; sin anuncio no hay nada", () => {
    expect(chatAdOf({ origin: { ...ORIGIN, body: "a ".repeat(500) }, known: null })!.body).toHaveLength(600);
    expect(chatAdOf({ origin: null, known: null })).toBeNull();
    expect([safeUrl("https://ok.example/a b"), safeUrl("ftp://x"), safeUrl("no es url"), safeUrl(null)]).toEqual(["https://ok.example/a%20b", null, null, null]);
  });

  it("un chat que no existe, de otra cuenta o con un id mal escrito responde «Ese chat no existe»", async () => {
    const lookups = new Map<string, ChatAdLookup>([[`t1:${CHAT}`, { origin: ORIGIN, known: null }]]);
    const service = new ChatAdOriginService({ find: async (tenantId, id) => lookups.get(`${tenantId}:${id}`) ?? null });
    expect((await service.get("t1", CHAT)).ad?.title).toBe("Tu canción");
    await expect(service.get("t2", CHAT)).rejects.toThrow("Ese chat no existe.");
    await expect(service.get("t1", "../../x")).rejects.toThrow("Ese chat no existe.");
  });
});
