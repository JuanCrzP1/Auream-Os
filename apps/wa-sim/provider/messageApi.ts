import type { Simulator } from "../core/Simulator";
import type { MenuOption, MessageKind } from "../core/types";
import { digitsOf, sendJson, text, type RouteContext, type Router } from "../http/http";
import { instanceOf, requireConnected } from "./auth";

// ---------------------------------------------------------------------------
// Enviar y lo que rodea a un mensaje, como en uazapi:
//
//   POST /send/text         { number, text, replyid }
//   POST /send/media        { number, type: image|video|audio|ptt|document, file, text, docName, replyid }
//   POST /send/menu         { number, type: button|list|poll, text, choices, footerText, listButton }
//   POST /message/react     { id, text }            reaccionar (vacío la quita)
//   POST /message/presence  { number, presence, delay }   «escribiendo…»
//   POST /message/download  { id }                  enlace de un archivo recibido
//
// Lo enviado queda en el chat del teléfono de prueba y responde con su
// `messageid` (con ese id llegan después los avisos de entregado y leído).
// ---------------------------------------------------------------------------

const MEDIA_KINDS: Readonly<Record<string, MessageKind>> = { image: "image", video: "video", audio: "audio", ptt: "audio", myaudio: "audio", document: "document" };

/** Opciones de un menú de uazapi: botón «texto|id»; lista «texto|id|descripción» y «[Sección]». */
export function parseChoices(raw: unknown): MenuOption[] {
  const choices = Array.isArray(raw) ? raw.map(text) : [];
  return choices
    .filter((choice) => choice && !/^\[.*\]$/.test(choice))
    .map((choice, index) => {
      const [title = "", id = "", description = ""] = choice.split("|");
      return { id: id || `opcion-${index + 1}`, title, ...(description ? { description } : {}) };
    });
}

async function sending(simulator: Simulator, context: RouteContext) {
  const instance = instanceOf(simulator.store, context);
  if (!instance || !requireConnected(instance, context)) return null;
  const body = await context.body();
  const phone = text(body["number"]).includes("@g.us") ? text(body["number"]) : digitsOf(body["number"]);
  if (!phone) {
    sendJson(context.response, 400, { error: "number is required" });
    return null;
  }
  return { instance, body, phone };
}

export function registerMessageApi(router: Router, simulator: Simulator): void {
  const { store } = simulator;
  const sent = (context: RouteContext, id: string) => sendJson(context.response, 200, { messageid: id, id, status: "Pending" });

  router.on("POST", "/send/text", async (context) => {
    const request = await sending(simulator, context);
    if (!request) return;
    const message = simulator.fromBusiness(request.instance, request.phone, { kind: "text", text: text(request.body["text"]), replyTo: text(request.body["replyid"]) || null });
    store.record("in", `texto a ${request.phone}: «${message.text.slice(0, 60)}»`);
    sent(context, message.id);
  });

  router.on("POST", "/send/media", async (context) => {
    const request = await sending(simulator, context);
    if (!request) return;
    const type = text(request.body["type"]);
    const kind = MEDIA_KINDS[type];
    if (!kind) return sendJson(context.response, 400, { error: `unsupported type ${type}` });
    const message = simulator.fromBusiness(request.instance, request.phone, {
      kind, text: text(request.body["text"]), mediaUrl: text(request.body["file"]) || null, fileName: text(request.body["docName"]) || null,
      voice: type === "ptt" || type === "myaudio", replyTo: text(request.body["replyid"]) || null
    });
    store.record("in", `${type === "ptt" ? "nota de voz" : type} a ${request.phone}`);
    sent(context, message.id);
  });

  router.on("POST", "/send/menu", async (context) => {
    const request = await sending(simulator, context);
    if (!request) return;
    const type = text(request.body["type"]) === "list" ? "list" : "button";
    const options = parseChoices(request.body["choices"]);
    const listButton = text(request.body["listButton"]);
    const message = simulator.fromBusiness(request.instance, request.phone, {
      kind: "menu", text: text(request.body["text"]), menu: { type, options, ...(listButton ? { button: listButton } : {}) }
    });
    store.record("in", `menú (${type}, ${options.length} opciones) a ${request.phone}`);
    sent(context, message.id);
  });

  router.on("POST", "/message/react", async (context) => {
    const instance = instanceOf(store, context);
    if (!instance) return;
    const body = await context.body();
    const target = store.message(text(body["id"]));
    if (!target) return sendJson(context.response, 404, { error: "message not found" });
    simulator.react(target, text(body["text"]));
    store.record("in", `reacción ${text(body["text"]) || "(quitar)"}`);
    sendJson(context.response, 200, { response: "Reaction sent" });
  });

  router.on("POST", "/message/presence", async (context) => {
    const instance = instanceOf(store, context);
    if (!instance) return;
    const body = await context.body();
    const delay = Math.min(Number(body["delay"]) || 1_000, 300_000);
    const state = text(body["presence"]) === "recording" ? "recording" : text(body["presence"]) === "paused" ? "paused" : "composing";
    store.presence.set(`${instance.id}:${digitsOf(body["number"])}`, { state, until: new Date(Date.now() + delay).toISOString() });
    sendJson(context.response, 200, { response: "Presence set" });
  });

  router.on("POST", "/message/download", async (context) => {
    const instance = instanceOf(store, context);
    if (!instance) return;
    const message = store.message(text((await context.body())["id"]));
    if (!message?.mediaUrl) return sendJson(context.response, 404, { error: "file not found" });
    sendJson(context.response, 200, { fileURL: message.mediaUrl, mimetype: message.mimeType ?? "" });
  });
}
