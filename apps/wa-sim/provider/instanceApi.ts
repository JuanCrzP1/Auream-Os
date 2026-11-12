import type { Simulator } from "../core/Simulator";
import type { SimInstance } from "../core/types";
import { sendJson, text, type Router } from "../http/http";
import { instanceOf, isAdmin } from "./auth";

// ---------------------------------------------------------------------------
// Los números (instancias), como en uazapi:
//
//   POST   /instance/create      admintoken   crear (desconectado)
//   POST   /instance/connect     token        pedir el QR
//   GET    /instance/status      token        estado, QR, número y perfil
//   POST   /instance/disconnect  token        cerrar la sesión
//   POST   /instance/reset       token        retomar la conexión
//   DELETE /instance             token        borrar
//   POST   /webhook              token        a dónde avisar y qué eventos
//   POST   /chat/avatar          token        foto de un cliente (no hay: vacía)
// ---------------------------------------------------------------------------

/** El estado como lo devuelve uazapi (lo lee `toInstanceInfo` de Auream). */
function statusBody(simulator: Simulator, instance: SimInstance) {
  return {
    instance: {
      id: instance.id,
      token: instance.token,
      name: instance.name,
      status: instance.status,
      qrcode: simulator.qrOf(instance),
      profileName: instance.profileName ?? "",
      profilePicUrl: "",
      owner: instance.phone ?? ""
    },
    status: { connected: instance.status === "connected", jid: instance.phone ? { user: instance.phone } : null }
  };
}

export function registerInstanceApi(router: Router, simulator: Simulator, adminToken: string): void {
  const { store } = simulator;

  router.on("POST", "/instance/create", async (context) => {
    if (!isAdmin(context, adminToken)) return;
    const body = await context.body();
    const name = text(body["name"]);
    if (!name) return sendJson(context.response, 400, { error: "name is required" });
    // El nombre del perfil lo pone quien «escanea» el QR (`systemName` es el del dispositivo, no del negocio).
    const instance = simulator.createInstance(name, null);
    store.record("in", `crear número «${name}»`);
    sendJson(context.response, 200, { ...statusBody(simulator, instance), token: instance.token });
  });

  router.on("POST", "/instance/connect", async (context) => {
    const instance = instanceOf(store, context);
    if (!instance) return;
    await simulator.startLinking(instance);
    store.record("in", `${instance.name}: pedir QR`);
    sendJson(context.response, 200, statusBody(simulator, instance));
  });

  router.on("GET", "/instance/status", (context) => {
    const instance = instanceOf(store, context);
    if (instance) sendJson(context.response, 200, statusBody(simulator, instance));
  });

  router.on("POST", "/instance/disconnect", async (context) => {
    const instance = instanceOf(store, context);
    if (!instance) return;
    await simulator.disconnect(instance);
    store.record("in", `${instance.name}: desconectar`);
    sendJson(context.response, 200, { response: "Disconnected" });
  });

  router.on("POST", "/instance/reset", async (context) => {
    const instance = instanceOf(store, context);
    if (!instance) return;
    // Con un número ya vinculado, retoma la conexión sin pedir QR.
    if (instance.phone) await simulator.scan(instance, instance.phone, null);
    store.record("in", `${instance.name}: retomar la conexión`);
    sendJson(context.response, 200, statusBody(simulator, instance));
  });

  router.on("DELETE", "/instance", (context) => {
    const instance = instanceOf(store, context);
    if (!instance) return;
    simulator.remove(instance);
    store.record("in", `${instance.name}: borrar`);
    sendJson(context.response, 200, { response: "Instance deleted" });
  });

  router.on("POST", "/webhook", async (context) => {
    const instance = instanceOf(store, context);
    if (!instance) return;
    const body = await context.body();
    instance.webhookUrl = body["enabled"] === false ? null : text(body["url"]) || null;
    instance.webhookEvents = Array.isArray(body["events"]) ? body["events"].map(text).filter(Boolean) : [];
    store.changed();
    store.record("in", `${instance.name}: avisos a ${instance.webhookUrl ?? "(ninguna)"} · ${instance.webhookEvents.join(", ")}`);
    sendJson(context.response, 200, { enabled: Boolean(instance.webhookUrl), url: instance.webhookUrl ?? "", events: instance.webhookEvents });
  });

  router.on("POST", "/chat/avatar", (context) => {
    if (instanceOf(store, context)) sendJson(context.response, 200, { url: "" });
  });
}
