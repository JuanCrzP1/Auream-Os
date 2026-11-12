import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSimulatorApp, type SimulatorApp } from "../../apps/wa-sim/server.js";
import { loadSimulatorConfig } from "../../apps/wa-sim/config.js";
import { loadWhatsAppSimulator } from "../../apps/api/config/loadWhatsAppSimulator.js";
import { UazapiClient } from "../../infrastructure/whatsapp/uazapi/UazapiClient.js";
import { UazapiGroupClient } from "../../infrastructure/whatsapp/uazapi/UazapiGroupClient.js";
import { WEBHOOK_EVENTS } from "../../infrastructure/whatsapp/uazapi/UazapiLinker.js";
import { parseUazapiMessage } from "../../infrastructure/whatsapp/uazapi/parseUazapiMessage.js";
import { parseUazapiReceipt } from "../../infrastructure/whatsapp/uazapi/parseUazapiReceipt.js";
import { parseUazapiGroupEvent, toProviderGroup } from "../../infrastructure/whatsapp/uazapi/parseUazapiGroups.js";

// ---------------------------------------------------------------------------
// Contrato del WhatsApp simulado: Auream le habla con su cliente REAL de
// uazapi y lee sus avisos con sus parsers REALES. Si el simulador se aleja
// de cómo habla uazapi (o Auream cambia lo que espera), esta prueba falla.
// ---------------------------------------------------------------------------

type Json = Record<string, unknown>;
const events: Json[] = [];
const advances: Array<{ url: string; body: Json }> = [];
const captureFetch: typeof fetch = async (url, init) => {
  const body = JSON.parse(String(init?.body)) as Json;
  // «Adelantar el tiempo» va a la ruta de desarrollo de Auream, no es un aviso.
  if (String(url).endsWith("/dev/simulator/advance")) {
    advances.push({ url: String(url), body });
    return Response.json({ advanced: ["2026-11-12T06:48:14.000Z"] });
  }
  events.push(body);
  return new Response("{}", { status: 200 });
};

let app: SimulatorApp;
let base: string;
const phoneApi = async (path: string, body: unknown) =>
  (await fetch(`${base}${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })).json() as Promise<Json>;
/** El último aviso de un tipo (los recibos de «entregado» llegan solos unos ms después y no deben confundirse). */
const lastOf = (type: string) => events.filter((event) => event["EventType"] === type).at(-1);
const waitFor = async (predicate: () => Json | undefined) => {
  for (let tries = 0; tries < 50; tries += 1) {
    const found = predicate();
    if (found) return found;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("El aviso no llegó.");
};

beforeAll(async () => {
  const config = { ...loadSimulatorConfig({}, process.cwd()), port: 0, dataDir: join(tmpdir(), "auream-wa-sim-test") };
  app = createSimulatorApp(config, { persist: false, deliveryDelayMs: 5, fetch: captureFetch });
  await new Promise<void>((resolve) => app.server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`;
});

afterAll(() => new Promise<void>((resolve) => app.server.close(() => resolve())));

describe("WhatsApp simulado ↔ cliente y parsers reales de uazapi", () => {
  const client = () => new UazapiClient({ baseUrl: base, adminToken: "simulador" });

  it("número: crear, QR, «escanear», enviar y recibos de entregado y leído", async () => {
    const created = await client().createInstance("auream-conexion-1", "Auream");
    await client().setWebhook(created.token, "http://auream.test/webhooks/uazapi", WEBHOOK_EVENTS);
    const linking = await client().connect(created.token);
    expect(linking).toMatchObject({ status: "connecting", qrcode: expect.stringMatching(/^data:image\//) });

    await phoneApi(`/_sim/instances/${created.id}/scan`, { phone: "573110000001" });
    expect(await client().status(created.token)).toMatchObject({ status: "connected", phoneNumber: "573110000001" });
    expect(events.find((event) => event["EventType"] === "connection" && (event["instance"] as Json)["status"] === "connected")).toBeTruthy();

    const sent = await client().sendText(created.token, "573009998877", "Hola, ¿en qué te ayudo?");
    expect(sent).toMatch(/^3EB0/);
    const delivered = parseUazapiReceipt(await waitFor(() => events.find((event) => event["EventType"] === "messages_update")));
    expect(delivered).toEqual({ ok: true, receipt: { instanceName: "auream-conexion-1", token: created.token, providerMessageIds: [sent], status: "delivered" } });

    await phoneApi(`/_sim/chats/${created.id}/573009998877/read`, {});
    const read = events.filter((event) => event["EventType"] === "messages_update").map((event) => parseUazapiReceipt(event));
    expect(read.at(-1)).toMatchObject({ ok: true, receipt: { status: "read" } });
  });

  it("el cliente escribe, responde un botón y llega desde un anuncio: Auream lo lee igual que uno real", async () => {
    const instance = [...app.store.instances.values()][0]!;
    await phoneApi("/_sim/contacts", { phone: "573005556677", name: "Laura Gómez", fromAd: true });
    await phoneApi(`/_sim/chats/${instance.id}/573005556677/send`, { text: "hola" });
    const hello = parseUazapiMessage(lastOf("messages"));
    expect(hello).toMatchObject({ ok: true, event: { instanceName: "auream-conexion-1", message: { phone: "573005556677", kind: "text", text: "hola", senderName: "Laura Gómez" } } });
    expect(hello.ok && hello.event.message.fromAd).toBe(true);

    const menu = await client().sendMenu(instance.token, "573005556677", { type: "button", text: "¿Qué buscas?", choices: ["Ver precios|precios", "Asesor|asesor"] });
    expect(app.store.message(menu!)?.menu?.options.map((option) => option.title)).toEqual(["Ver precios", "Asesor"]);
    await phoneApi(`/_sim/chats/${instance.id}/573005556677/send`, { kind: "button_reply", text: "Ver precios", choiceId: "precios" });
    expect(parseUazapiMessage(lastOf("messages"))).toMatchObject({ ok: true, event: { message: { kind: "button_reply", text: "Ver precios", replyId: "precios" } } });
  });

  it("archivos, notas de voz y reacciones", async () => {
    const instance = [...app.store.instances.values()][0]!;
    const voice = await client().sendMedia(instance.token, "573005556677", { type: "ptt", file: "https://blob.test/nota.ogg" });
    expect(app.store.message(voice!)).toMatchObject({ kind: "audio", voice: true });
    await client().react(instance.token, voice!, "👍");
    expect(app.store.message(voice!)?.reaction).toBe("👍");

    await phoneApi(`/_sim/chats/${instance.id}/573005556677/send`, { kind: "image", mediaUrl: `${base}/_sim/files/x.jpg`, mimeType: "image/jpeg", text: "comprobante" });
    // Enlace local (no https): Auream pide el archivo a uazapi, como con uno real sin enlace en el aviso.
    const photo = parseUazapiMessage(lastOf("messages"));
    expect(photo).toMatchObject({ ok: true, event: { needsMediaDownload: true, message: { kind: "image", text: "comprobante" } } });
    const file = await client().downloadMedia(instance.token, photo.ok ? photo.event.message.providerMessageId : "");
    expect(file).toEqual({ url: `${base}/_sim/files/x.jpg`, mimeType: "image/jpeg" });
  });

  it("grupos: crear, listar y quién entra", async () => {
    const instance = [...app.store.instances.values()][0]!;
    const groups = new UazapiGroupClient({ baseUrl: base });
    const jid = await groups.create(instance.token, "Clientes VIP");
    const listed = (await groups.list(instance.token)).map((group) => toProviderGroup(group, instance.phone));
    expect(listed[0]).toMatchObject({ jid, name: "Clientes VIP", isAdmin: true });
    await phoneApi(`/_sim/groups/${encodeURIComponent(jid)}/members`, { join: ["573001231234"] });
    expect(parseUazapiGroupEvent(lastOf("groups")!)).toMatchObject({ jid, joins: [{ phone: "573001231234" }] });
  });

  it("adelantar el tiempo: le pide a Auream, con el token del número, que corra ya lo que el chat esperaba", async () => {
    const instance = [...app.store.instances.values()][0]!;
    const answer = await phoneApi(`/_sim/chats/${instance.id}/573005556677/advance`, {});
    expect(answer).toEqual({ ok: true, advanced: ["2026-11-12T06:48:14.000Z"] });
    expect(advances.at(-1)).toEqual({
      url: "http://auream.test/dev/simulator/advance",
      body: { connectionId: "conexion-1", token: instance.token, phone: "573005556677" }
    });
  });

  it("solo en desarrollo: ni el simulador ni la API lo aceptan en producción", () => {
    expect(() => loadSimulatorConfig({ NODE_ENV: "production" })).toThrow(/solo para desarrollo/);
    expect(() => loadSimulatorConfig({ VERCEL: "1" })).toThrow(/solo para desarrollo/);
    expect(() => loadWhatsAppSimulator({ WHATSAPP_SIMULATOR_URL: "http://localhost:3200" }, true)).toThrow(/solo para desarrollo/);
    expect(() => loadWhatsAppSimulator({ WHATSAPP_SIMULATOR_URL: "https://otro.com" }, false)).toThrow(/dirección local/);
    expect(loadWhatsAppSimulator({ WHATSAPP_SIMULATOR_URL: "http://localhost:3200" }, false)).toEqual({ baseUrl: "http://localhost:3200", adminToken: "simulador" });
  });
});
