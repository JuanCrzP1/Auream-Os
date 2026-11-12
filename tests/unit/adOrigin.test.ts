import { describe, expect, it, vi } from "vitest";
import { parseUazapiMessage } from "../../infrastructure/whatsapp/uazapi/parseUazapiMessage.js";
import { ContactDirectoryService } from "../../domains/contacts/application/ContactDirectoryService.js";
import { InMemoryContactRepository, InMemoryContactsStore, InMemoryLabelRepository } from "../../infrastructure/persistence/memory/InMemoryContactRepositories.js";
import { templateResolver } from "../../flow-engine/templates/templateResolver.js";
import type { AdOrigin } from "../../contracts/AdOrigin.js";
import type { RuntimeInput } from "../../contracts/RuntimeContracts.js";

// ---------------------------------------------------------------------------
// El anuncio de clic a WhatsApp por el que entró un cliente, como lo guarda
// Leona: se lee del aviso de uazapi, queda en la ficha (el último reemplaza al
// anterior) y se usa por dentro con los nombres de Leona (`{source_url}`…;
// `{ctwa_clid}` lo usa el Pixel para atribuir la compra al anuncio).
// ---------------------------------------------------------------------------

const T = "11111111-1111-4111-8111-111111111111";
const AD: AdOrigin = {
  sourceId: "120244659737030395",
  sourceUrl: "https://fb.me/bPoVjTxvu",
  mediaUrl: "https://www.facebook.com/reel/1520926423139867/",
  thumbnailUrl: "https://scontent.example/miniatura.jpg",
  ctwaClid: "AfiqyOHfyF2N6sQ60Y4J"
};

const aviso = (message: Record<string, unknown>) => ({
  EventType: "messages",
  token: "token",
  instanceName: "auream-x",
  message: { messageid: "MSG1", chatid: "584121112233@s.whatsapp.net", senderName: "Laura", fromMe: false, isGroup: false, messageType: "ExtendedTextMessage", text: "Hola", messageTimestamp: 1794200000000, ...message }
});

function parsedAd(body: unknown) {
  const parsed = parseUazapiMessage(body);
  if (!parsed.ok) throw new Error(parsed.ignored);
  return { ad: parsed.event.message.ad, fromAd: parsed.event.message.fromAd };
}

describe("lectura del anuncio en el aviso de uazapi", () => {
  it("toma los datos de `externalAdReply` con los nombres de WhatsApp, también el título y el texto", () => {
    const body = aviso({
      content: {
        text: "Hola",
        contextInfo: {
          conversionSource: "FB_Ads",
          externalAdReply: { sourceID: AD.sourceId, sourceURL: AD.sourceUrl, mediaURL: AD.mediaUrl, thumbnailURL: AD.thumbnailUrl, ctwaClid: AD.ctwaClid, title: "Tu canción", body: "Regala una canción con su nombre" }
        }
      }
    });
    expect(parsedAd(body)).toEqual({ ad: { ...AD, title: "Tu canción", body: "Regala una canción con su nombre" }, fromAd: true });
  });

  it("también del formato `referral` (snake_case) y con datos parciales; un mensaje normal no trae anuncio", () => {
    const referral = aviso({ referral: { source_id: AD.sourceId, source_url: AD.sourceUrl, video_url: AD.mediaUrl, ctwa_clid: AD.ctwaClid } });
    expect(parsedAd(referral).ad).toEqual({ ...AD, thumbnailUrl: null });
    expect(parsedAd(aviso({}))).toEqual({ ad: null, fromAd: false });
  });
});

describe("el anuncio en la ficha del contacto", () => {
  function directory() {
    const store = new InMemoryContactsStore();
    const contacts = new InMemoryContactRepository(store);
    const setAdOrigin = vi.spyOn(contacts, "setAdOrigin");
    return { setAdOrigin, directory: new ContactDirectoryService(contacts, new InMemoryLabelRepository(store)) };
  }
  const identity = { channel: "whatsapp", externalKey: "584121112233" };

  it("se guarda al llegar por un anuncio (con la fecha); el mismo anuncio no se reescribe salvo que traiga su título; otro anuncio reemplaza al anterior; sin anuncio, queda el último", async () => {
    const { directory: dir, setAdOrigin } = directory();
    const first = (await dir.identify(T, identity, "Laura", AD)).profile.ad!;
    expect(first).toEqual({ ...AD, receivedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/) });
    await dir.identify(T, identity, "Laura", AD);
    expect(setAdOrigin).toHaveBeenCalledTimes(1);
    // El mismo anuncio, ahora con título: se completa y conserva cuándo llegó.
    expect((await dir.identify(T, identity, "Laura", { ...AD, title: "Tu canción" })).profile.ad).toEqual({ ...AD, title: "Tu canción", receivedAt: first.receivedAt });

    const otro = { ...AD, sourceId: "999", ctwaClid: "otro-clic" };
    await dir.identify(T, identity, "Laura", otro);
    expect((await dir.identify(T, identity, "Laura")).profile.ad).toMatchObject(otro);
    expect((await dir.resolve(T, identity)).ad).toMatchObject(otro);
  });
});

describe("variables del anuncio", () => {
  const input = (context: Record<string, unknown> = {}) =>
    ({ envelope: { tenantId: T, flowKey: "f", channel: "whatsapp", conversationKey: "c", userKey: "584121112233", messageId: "m", payload: {}, receivedAt: "2026-11-09T19:35:00.000Z" }, sessionContext: context, isWaitingInput: false, now: "2026-11-09T19:35:00.000Z", timezone: "America/Bogota" }) as RuntimeInput;
  const profile = { id: "c1", name: "Laura", phone: "584121112233", email: null, tags: [], fields: {}, ad: AD };

  it("con los nombres de Leona; un dato del flujo con el mismo nombre manda; sin anuncio, quedan vacías", () => {
    const resolve = templateResolver(input(), profile);
    expect(["source_id", "source_url", "media_url", "thumbnail_url", "ctwa_clid"].map(resolve)).toEqual([AD.sourceId, AD.sourceUrl, AD.mediaUrl, AD.thumbnailUrl, AD.ctwaClid]);
    expect(templateResolver(input({ source_url: "propio" }), profile)("source_url")).toBe("propio");
    expect(templateResolver(input(), { ...profile, ad: null })("ctwa_clid")).toBeUndefined();
  });
});
