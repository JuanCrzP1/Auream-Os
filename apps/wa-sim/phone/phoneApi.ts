import type { Simulator } from "../core/Simulator";
import type { MessageKind, SimInstance } from "../core/types";
import { digitsOf, sendJson, text, type RouteContext, type Router } from "../http/http";
import { groupMembersEvent } from "../webhooks/uazapiEvents";
import type { AureamClock } from "../webhooks/AureamClock";
import type { AureamNotifier } from "../webhooks/AureamNotifier";
import type { SimFiles } from "./SimFiles";

// ---------------------------------------------------------------------------
// La API del teléfono de prueba (`/_sim/…`): lo que hace la persona que prueba.
//
//   GET  /_sim/state                              números, chats y lo que pasó
//   GET  /_sim/chats/:instance/:phone             los mensajes de un chat
//   POST /_sim/instances/:instance/scan           «escanear» el QR { phone, profileName }
//   POST /_sim/instances/:instance/disconnect     desconectar el número
//   POST /_sim/contacts                           un cliente nuevo { phone, name, fromAd }
//   POST /_sim/chats/:instance/:phone/send        escribir como cliente
//   POST /_sim/chats/:instance/:phone/read        abrir el chat (todo «leído»)
//   POST /_sim/chats/:instance/:phone/advance     adelantar el tiempo (lo que el flujo esperaba corre ya)
//   POST /_sim/files                              subir un archivo { base64, mimeType }
//   POST /_sim/groups/:jid/members                alguien entra o sale { join, leave }
//   POST /_sim/reset                              empezar de cero
// ---------------------------------------------------------------------------

const KINDS: ReadonlyArray<MessageKind> = ["text", "image", "video", "audio", "document", "button_reply", "list_reply"];

function instanceParam(simulator: Simulator, context: RouteContext): SimInstance | null {
  const instance = simulator.store.instances.get(context.params["instance"]!);
  if (!instance) sendJson(context.response, 404, { error: "Ese número no existe en el simulador." });
  return instance ?? null;
}

export function registerPhoneApi(router: Router, simulator: Simulator, notifier: AureamNotifier, files: SimFiles, clock: AureamClock): void {
  const { store } = simulator;

  router.on("GET", "/_sim/state", (context) => {
    const chats = [...new Set(store.messages.map((message) => `${message.instanceId}:${message.contactPhone}`))].map((key) => {
      const [instanceId, phone] = key.split(":") as [string, string];
      const messages = store.chat(instanceId, phone);
      const last = messages.at(-1)!;
      return { instanceId, phone, name: store.contacts.get(phone)?.name ?? phone, last: last.text || last.kind, at: last.at, fromBusiness: last.fromBusiness };
    });
    sendJson(context.response, 200, {
      instances: [...store.instances.values()].map(({ token: _token, ...instance }) => instance),
      contacts: [...store.contacts.values()],
      groups: [...store.groups.values()],
      chats: chats.sort((a, b) => b.at.localeCompare(a.at)),
      log: store.log.slice(0, 60)
    });
  });

  router.on("GET", "/_sim/chats/:instance/:phone", (context) => {
    const instance = instanceParam(simulator, context);
    if (!instance) return;
    const phone = context.params["phone"]!;
    const presence = store.presence.get(`${instance.id}:${phone}`);
    const typing = presence && Date.parse(presence.until) > Date.now() && presence.state !== "paused" ? presence.state : null;
    sendJson(context.response, 200, { contact: store.contacts.get(phone) ?? null, messages: store.chat(instance.id, phone), presence: typing });
  });

  router.on("POST", "/_sim/instances/:instance/scan", async (context) => {
    const instance = instanceParam(simulator, context);
    if (!instance) return;
    const body = await context.body();
    const phone = digitsOf(body["phone"]) || `57300${String(Math.floor(Math.random() * 1e7)).padStart(7, "0")}`;
    await simulator.scan(instance, phone, text(body["profileName"]) || "Negocio de prueba");
    sendJson(context.response, 200, { status: instance.status, phone });
  });

  router.on("POST", "/_sim/instances/:instance/disconnect", async (context) => {
    const instance = instanceParam(simulator, context);
    if (!instance) return;
    await simulator.disconnect(instance);
    sendJson(context.response, 200, { status: instance.status });
  });

  router.on("POST", "/_sim/contacts", async (context) => {
    const body = await context.body();
    const phone = digitsOf(body["phone"]);
    if (phone.length < 7) return sendJson(context.response, 400, { error: "Escribe el número completo, con el prefijo del país." });
    const contact = store.contact(phone, text(body["name"]) || undefined);
    contact.ad = body["fromAd"] === true ? { sourceId: text(body["adId"]) || "120244134508290395", sourceUrl: "https://fb.me/simulado", ctwaClid: `sim-${Date.now()}` } : null;
    store.changed();
    sendJson(context.response, 200, contact);
  });

  router.on("POST", "/_sim/chats/:instance/:phone/send", async (context) => {
    const instance = instanceParam(simulator, context);
    if (!instance) return;
    if (instance.status !== "connected") return sendJson(context.response, 409, { error: "El número no está conectado: escanea el QR primero." });
    const body = await context.body();
    const kind = KINDS.includes(text(body["kind"]) as MessageKind) ? (text(body["kind"]) as MessageKind) : "text";
    const message = await simulator.fromClient(instance, context.params["phone"]!, {
      kind, text: text(body["text"]), mediaUrl: text(body["mediaUrl"]) || null, mimeType: text(body["mimeType"]) || null,
      fileName: text(body["fileName"]) || null, voice: body["voice"] === true, choiceId: text(body["choiceId"]) || null, replyTo: text(body["replyTo"]) || null
    });
    sendJson(context.response, 200, message);
  });

  router.on("POST", "/_sim/chats/:instance/:phone/advance", async (context) => {
    const instance = instanceParam(simulator, context);
    if (!instance) return;
    const result = await clock.advance(instance, digitsOf(context.params["phone"]));
    sendJson(context.response, result.ok ? 200 : 502, result);
  });

  router.on("POST", "/_sim/chats/:instance/:phone/read", async (context) => {
    const instance = instanceParam(simulator, context);
    if (instance) sendJson(context.response, 200, { read: await simulator.read(instance, context.params["phone"]!) });
  });

  router.on("POST", "/_sim/files", async (context) => {
    const body = await context.body();
    try {
      sendJson(context.response, 200, files.save(text(body["base64"]), text(body["mimeType"]) || "application/octet-stream"));
    } catch (error) {
      sendJson(context.response, 400, { error: error instanceof Error ? error.message : "No se pudo guardar el archivo." });
    }
  });

  router.on("POST", "/_sim/groups/:jid/members", async (context) => {
    const group = store.groups.get(context.params["jid"]!);
    const instance = group ? store.instances.get(group.instanceId) : null;
    if (!group || !instance) return sendJson(context.response, 404, { error: "Ese grupo no existe." });
    const body = await context.body();
    const list = (value: unknown) => (Array.isArray(value) ? value.map(digitsOf).filter((phone) => phone.length >= 7) : []);
    const [joins, leaves] = [list(body["join"]), list(body["leave"])];
    group.participants = [...new Set([...group.participants.filter((phone) => !leaves.includes(phone)), ...joins])];
    store.changed();
    await notifier.send(instance, groupMembersEvent(instance, group, joins, leaves));
    sendJson(context.response, 200, group);
  });

  router.on("POST", "/_sim/reset", (context) => {
    store.reset();
    sendJson(context.response, 200, { reset: true });
  });
}
