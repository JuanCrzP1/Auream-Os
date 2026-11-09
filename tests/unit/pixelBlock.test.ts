import { describe, expect, it, vi } from "vitest";
import { createHash, randomBytes } from "node:crypto";
import { parseAmount } from "../../flow-engine/values/parseAmount.js";
import { buildConversionEvent } from "../../flow-engine/nodes/pixel/buildConversionEvent.js";
import { PixelNodeHandler } from "../../flow-engine/nodes/pixel/PixelNodeHandler.js";
import { readPixelConfig } from "../../contracts/PixelConfig.js";
import { toMetaUserData } from "../../infrastructure/meta/metaUserData.js";
import { MetaConversionsClient, type FetchLike } from "../../infrastructure/meta/MetaConversionsClient.js";
import { VaultConversionTracker } from "../../apps/api/composition/VaultConversionTracker.js";
import { PixelConnectionVault } from "../../domains/integrations/application/PixelConnectionVault.js";
import { CreatePixelConnectionService, VerifyPixelConnectionService } from "../../domains/integrations/application/PixelConnectionServices.js";
import { InMemoryPixelConnectionRepository } from "../../infrastructure/persistence/memory/InMemoryPixelConnectionRepository.js";
import { AesGcmSecretCipher } from "../../platform/security/secrets/AesGcmSecretCipher.js";
import { simulationDependencies } from "../../apps/api/composition/composeNodeRuntime.js";
import type { ConversionEvent, ConversionTracker, TrackConversionRequest } from "../../flow-engine/ports/ConversionTracker.js";
import type { MetaPixelAccess } from "../../domains/integrations/application/ports/MetaPixelAccess.js";
import type { FlowNode } from "../../contracts/FlowSnapshot.js";
import type { RuntimeInput, Session } from "../../contracts/RuntimeContracts.js";

// ---------------------------------------------------------------------------
// Bloque Pixel: evento de conversión bien armado (valor, atribución al anuncio
// de clic a WhatsApp), datos cifrados como exige Meta, token cifrado en la
// cuenta y una conversación que NUNCA se detiene porque Meta falle.
// ---------------------------------------------------------------------------

const sha = (v: string) => createHash("sha256").update(v).digest("hex");

describe("parseAmount", () => {
  it.each([
    ["49900", 49900],
    ["49.900", 49900],
    ["$ 49.900", 49900],
    ["1.234.567", 1234567],
    ["1.234,50", 1234.5],
    ["1,234.50", 1234.5],
    ["49,90", 49.9],
    ["49.9", 49.9],
    ["12.5 USD", 12.5],
    ["COP 150.000", 150000]
  ])("«%s» → %s", (raw, value) => {
    expect(parseAmount(raw)).toBe(value);
  });

  it.each(["", "gratis", "0", "-5", "abc,def"])("«%s» no es un valor", (raw) => {
    expect(parseAmount(raw)).toBeNull();
  });
});

const vars = (values: Record<string, string>) => (name: string) => values[name];
const ctx = (values: Record<string, string> = {}) => ({ resolve: vars({ full_name: "Laura Gómez Ruiz", phone: "573001112233", email: "Laura@Mail.com", ...values }), externalId: "c-1", eventId: "s:n:m", now: new Date("2026-11-08T12:00:00Z") });

describe("buildConversionEvent", () => {
  it("Lead de conversación normal: action_source chat", () => {
    const built = buildConversionEvent(readPixelConfig({ connectionId: "p1", event: "lead" }), ctx());
    expect(built.ok && built.event).toMatchObject({
      name: "Lead",
      actionSource: "chat",
      eventId: "s:n:m",
      eventTime: 1794139200,
      user: { externalId: "c-1", phone: "573001112233", email: "Laura@Mail.com", firstName: "Laura", lastName: "Gómez Ruiz" }
    });
  });

  it("si llegó por un anuncio de clic a WhatsApp, se atribuye al anuncio (LeadSubmitted)", () => {
    const built = buildConversionEvent(readPixelConfig({ connectionId: "p1", event: "lead", pageId: "{pagina}" }), ctx({ ctwa_clid: "ARAkLkA8rmlFeiCktEJQ", pagina: "1029384756" }));
    expect(built.ok && built.event).toMatchObject({ name: "LeadSubmitted", actionSource: "business_messaging", user: { ctwaClid: "ARAkLkA8rmlFeiCktEJQ", pageId: "1029384756" } });
  });

  it("sin página no se puede atribuir al anuncio: queda como chat", () => {
    const built = buildConversionEvent(readPixelConfig({ connectionId: "p1", event: "lead" }), ctx({ ctwa_clid: "ARAk" }));
    expect(built.ok && built.event.actionSource).toBe("chat");
  });

  it("Compra con valor desde una variable y su moneda", () => {
    const built = buildConversionEvent(readPixelConfig({ connectionId: "p1", event: "purchase", value: "{comprobante.valor}", currency: "COP" }), ctx({ "comprobante.valor": "$ 149.900" }));
    expect(built.ok && built.event).toMatchObject({ name: "Purchase", value: 149900, currency: "COP" });
  });

  it.each([
    [{ event: "lead" }, "not_configured"],
    [{ connectionId: "p1", event: "purchase", value: "gratis" }, "invalid_value"],
    [{ connectionId: "p1", event: "purchase", value: "{nada}" }, "invalid_value"],
    [{ connectionId: "p1", event: "lead", pageId: "mi-pagina" }, "invalid_page"]
  ])("rechaza %j → %s", (config, reason) => {
    const built = buildConversionEvent(readPixelConfig(config), ctx());
    expect(built.ok ? null : built.reason).toBe(reason);
  });
});

describe("datos del cliente para Meta", () => {
  it("normaliza y cifra con SHA-256; el clic y la página van sin cifrar", () => {
    const data = toMetaUserData({ externalId: "c-1", phone: "+57 300 111 2233", email: "  Laura@Mail.COM ", firstName: "Láura", lastName: "Gómez", ctwaClid: "ARAk", pageId: "123" });
    expect(data).toEqual({
      external_id: [sha("c-1")],
      ph: [sha("573001112233")],
      em: [sha("laura@mail.com")],
      fn: [sha("laura")],
      ln: [sha("gomez")],
      ctwa_clid: "ARAk",
      page_id: "123"
    });
    expect(JSON.stringify(data)).not.toContain("Laura");
  });
});

function network(status: number, body: unknown) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fetchImpl: FetchLike = async (url, init = {}) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(body), { status });
  };
  return { calls, fetchImpl };
}

const TOKEN = "EAAOtokenDePruebaMuyLargo0123456789ZDZD";
const EVENT: ConversionEvent = { name: "Purchase", eventId: "e1", eventTime: 1, actionSource: "business_messaging", user: { externalId: "c", ctwaClid: "ARAk", pageId: "123" }, value: 10, currency: "COP" };

describe("MetaConversionsClient", () => {
  it("envía el evento al píxel con el token en la cabecera y el código de prueba", async () => {
    const net = network(200, { events_received: 1, fbtrace_id: "x" });
    const result = await new MetaConversionsClient("v23.0", net.fetchImpl).send("1234567890", TOKEN, EVENT, "TEST123");

    expect(result).toEqual({ ok: true, eventsReceived: 1 });
    expect(net.calls[0]!.url).toBe("https://graph.facebook.com/v23.0/1234567890/events");
    expect(net.calls[0]!.url).not.toContain(TOKEN);
    expect((net.calls[0]!.init.headers as Record<string, string>)["authorization"]).toBe(`Bearer ${TOKEN}`);
    const body = JSON.parse(String(net.calls[0]!.init.body));
    expect(body.test_event_code).toBe("TEST123");
    expect(body.data[0]).toMatchObject({ event_name: "Purchase", action_source: "business_messaging", messaging_channel: "whatsapp", custom_data: { value: 10, currency: "COP" } });
  });

  it.each([
    [400, { error: { code: 190, message: `Invalid OAuth access token ${TOKEN}` } }, "invalid_token"],
    [400, { error: { code: 100, error_subcode: 33, message: "Object does not exist" } }, "pixel_not_found"],
    [400, { error: { code: 4, message: "Too many calls" } }, "rate_limited"],
    [400, { error: { code: 100, message: "Invalid parameter", error_user_msg: "Falta un dato" } }, "invalid_event"],
    [500, { error: { message: "boom" } }, "provider_error"]
  ])("HTTP %i → %s, sin filtrar el token", async (status, body, reason) => {
    const result = await new MetaConversionsClient("v23.0", network(status, body).fetchImpl).send("1234567890", TOKEN, EVENT);
    expect(result.ok ? null : result.reason).toBe(reason);
    expect(JSON.stringify(result)).not.toContain(TOKEN);
  });

  it("verifica el acceso al píxel", async () => {
    expect(await new MetaConversionsClient("v23.0", network(200, { id: "1", name: "Mi píxel" }).fetchImpl).verifyPixel("1234567890", TOKEN)).toEqual({ ok: true, pixelName: "Mi píxel" });
    expect(await new MetaConversionsClient("v23.0", network(400, { error: { code: 190 } }).fetchImpl).verifyPixel("1", TOKEN)).toMatchObject({ ok: false, reason: "invalid_token" });
    expect(await new MetaConversionsClient("v23.0", network(503, {}).fetchImpl).verifyPixel("1", TOKEN)).toMatchObject({ ok: false, reason: "unavailable" });
  });
});

const T = "11111111-1111-1111-1111-111111111111";
const cipher = new AesGcmSecretCipher({ current: "v1", keys: { v1: randomBytes(32) } });
const access = (ok = true): MetaPixelAccess => ({ verifyPixel: async () => (ok ? { ok: true } : { ok: false, reason: "invalid_token", message: "x" }) });

describe("píxeles de la cuenta", () => {
  it("guarda el token cifrado tras verificarlo; el vault lo revela solo en su cuenta", async () => {
    const repo = new InMemoryPixelConnectionRepository();
    const summary = await new CreatePixelConnectionService(repo, cipher, access()).execute(T, { name: "Ventas", pixelId: "3151000009796", accessToken: TOKEN });

    expect(summary).toMatchObject({ name: "Ventas", pixelId: "3151000009796", tokenHint: "••••ZDZD", status: "active" });
    expect(JSON.stringify(await repo.listByTenant(T))).not.toContain(TOKEN);
    expect(await new PixelConnectionVault(repo, cipher).reveal(T, summary.id)).toMatchObject({ accessToken: TOKEN });
    expect(await new PixelConnectionVault(repo, cipher).reveal("otra", summary.id)).toBeNull();
  });

  it.each([
    [{ pixelId: "abc", accessToken: TOKEN }, /solo números/],
    [{ pixelId: "3151000009796", accessToken: "corto" }, /token no parece válido/]
  ])("valida la entrada %#", async (input, message) => {
    await expect(new CreatePixelConnectionService(new InMemoryPixelConnectionRepository(), cipher, access()).execute(T, input)).rejects.toThrow(message);
  });

  it("no guarda un token que Meta rechaza; verificar marca uno revocado como inválido", async () => {
    const repo = new InMemoryPixelConnectionRepository();
    await expect(new CreatePixelConnectionService(repo, cipher, access(false)).execute(T, { pixelId: "3151000009796", accessToken: TOKEN })).rejects.toThrow(/Meta rechazó el token/);
    const created = await new CreatePixelConnectionService(repo, cipher, access()).execute(T, { pixelId: "3151000009796", accessToken: TOKEN });
    expect((await new VerifyPixelConnectionService(repo, cipher, access(false)).execute(T, created.id)).status).toBe("invalid");
  });
});

describe("PixelNodeHandler", () => {
  const input: RuntimeInput = {
    envelope: { tenantId: "t", flowKey: "f", channel: "whatsapp", conversationKey: "c", userKey: "573001112233", messageId: "msg-9", payload: { text: "pagué" }, receivedAt: "2026-11-08T00:00:00.000Z" },
    sessionContext: { ctwa_clid: "ARAk" },
    isWaitingInput: false,
    now: "2026-11-08T12:00:00.000Z",
    timezone: "UTC"
  };
  const session = { id: "ses-1", tenantId: "t", context: {} } as unknown as Session;
  const node = (config: Record<string, unknown>) => ({ id: "px", type: "pixel", name: "Pixel", content: {}, config, metadata: {} }) as unknown as FlowNode;

  it("envía la conversión con un id de evento estable por ejecución", async () => {
    const track = vi.fn(async (_t: string, _r: TrackConversionRequest) => ({ ok: true as const, eventsReceived: 1 }));
    const result = await new PixelNodeHandler({ track }, simulationDependencies().contacts).execute(node({ connectionId: "p1", event: "lead", pageId: "1029384756" }), input, session);

    const request = track.mock.calls[0]![1];
    expect(request).toMatchObject({ connectionId: "p1", event: { name: "LeadSubmitted", eventId: "ses-1:px:msg-9", actionSource: "business_messaging" } });
    expect(result.executionStatus).toBe("success");
    expect(result.domainEvents).toEqual(["pixel_sent:px:LeadSubmitted"]);
  });

  it("si Meta falla, la conversación SIGUE y el motivo queda registrado", async () => {
    const tracker: ConversionTracker = { track: async () => ({ ok: false, reason: "invalid_token", message: "token vencido" }) };
    const result = await new PixelNodeHandler(tracker, simulationDependencies().contacts).execute(node({ connectionId: "p1", event: "purchase", value: "50000" }), input, session);

    expect(result.executionStatus).toBe("success");
    expect(result.output).toBeUndefined();
    expect(result.nodeResult).toMatchObject({ reason: "invalid_token", eventName: "Purchase", value: 50000 });
    expect(result.domainEvents).toEqual(["pixel_failed:px:invalid_token"]);
  });

  it("VaultConversionTracker: descifra solo en su cuenta y llama a Meta con el token", async () => {
    const repo = new InMemoryPixelConnectionRepository();
    const created = await new CreatePixelConnectionService(repo, cipher, access()).execute("t", { pixelId: "3151000009796", accessToken: TOKEN });
    const net = network(200, { events_received: 1 });
    const tracker = new VaultConversionTracker(new PixelConnectionVault(repo, cipher), new MetaConversionsClient("v23.0", net.fetchImpl));

    expect(await tracker.track("t", { connectionId: created.id, event: EVENT })).toEqual({ ok: true, eventsReceived: 1 });
    expect((net.calls[0]!.init.headers as Record<string, string>)["authorization"]).toBe(`Bearer ${TOKEN}`);
    expect(await tracker.track("otra", { connectionId: created.id, event: EVENT })).toMatchObject({ ok: false, reason: "connection_not_found" });
  });
});
