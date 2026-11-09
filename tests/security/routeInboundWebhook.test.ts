import { describe, expect, it, vi } from "vitest";
import { Readable } from "node:stream";
import { randomBytes } from "node:crypto";
import type { IncomingMessage } from "node:http";
import { routeInboundWebhook } from "../../apps/api/routes/routeInboundWebhook.js";
import { WebhookAdminServices } from "../../domains/webhooks/application/WebhookAdminServices.js";
import { ReceiveWebhookService } from "../../domains/webhooks/application/ReceiveWebhookService.js";
import { InMemoryWebhookRepository } from "../../infrastructure/persistence/memory/InMemoryWebhookRepository.js";
import { AesGcmSecretCipher } from "../../platform/security/secrets/AesGcmSecretCipher.js";
import { InMemoryRateLimiter } from "../../platform/security/rate-limiting/application/InMemoryRateLimiter.js";
import { TooManyRequestsError } from "../../platform/observability/errors/TooManyRequestsError.js";

// `POST /hooks/in/<id>/<secreto>`: sin sesión, lo autoriza el secreto; 404
// sin decir si falló el id o el secreto; JSON o formulario; 202 y procesa en
// segundo plano; límite por webhook.

const T = "11111111-1111-4111-8111-111111111111";

async function setup() {
  const repository = new InMemoryWebhookRepository();
  const cipher = new AesGcmSecretCipher({ current: "v1", keys: { v1: randomBytes(32) } });
  const connections = { find: async () => null };
  const admin = new WebhookAdminServices({ repository, connections, cipher, publicBaseUrl: "https://x/api", newId: () => "00000000-0000-4000-8000-000000000001", newSecret: () => "s3cr3t" });
  const receive = new ReceiveWebhookService({ repository, cipher, contacts: { identify: vi.fn(), update: vi.fn(), addTags: vi.fn(), removeTags: vi.fn() }, connections, flows: { launch: vi.fn() } });
  await admin.create(T, { name: "Formulario" });
  const jobs: Array<() => Promise<unknown>> = [];
  const limiter = new InMemoryRateLimiter();
  const call = async (path: string, init: { readonly method?: string; readonly body?: string; readonly type?: string } = {}) => {
    const request = Object.assign(Readable.from(init.body ? [Buffer.from(init.body)] : []), { method: init.method ?? "POST", url: path, headers: { "content-type": init.type ?? "application/json" } }) as unknown as IncomingMessage;
    const response = { statusCode: 0, body: "", setHeader() {}, end(chunk?: string) { response.body = chunk ?? ""; } };
    const handled = await routeInboundWebhook(request, response as never, new URL(`http://x${path}`), { admin, receive } as never, { run: (job) => void jobs.push(job) }, limiter);
    return { handled, status: response.statusCode };
  };
  return { call, jobs, repository };
}

const URL_OK = "/hooks/in/00000000-0000-4000-8000-000000000001/s3cr3t";

describe("routeInboundWebhook", () => {
  it("con la dirección correcta responde 202 y procesa en segundo plano (queda como ejemplo)", async () => {
    const s = await setup();
    expect(await s.call(URL_OK, { body: JSON.stringify({ telefono: "3001234567" }) })).toEqual({ handled: true, status: 202 });
    await Promise.all(s.jobs.map((job) => job()));
    expect([...s.repository.webhooks.values()][0]!.sample).toEqual({ telefono: "3001234567" });
  });

  it("otro secreto o un id que no existe: 404, sin procesar nada; otras rutas no son suyas", async () => {
    const s = await setup();
    expect(await s.call("/hooks/in/00000000-0000-4000-8000-000000000001/otro", { body: "{}" })).toEqual({ handled: true, status: 404 });
    expect(await s.call("/hooks/in/no-es-uuid/s3cr3t", { body: "{}" })).toEqual({ handled: true, status: 404 });
    expect(s.jobs).toHaveLength(0);
    expect((await s.call("/inbound-webhooks")).handled).toBe(false);
  });

  it("acepta formularios; rechaza GET (405) y un envío que no es un objeto (400)", async () => {
    const s = await setup();
    expect((await s.call(URL_OK, { body: "nombre=Laura&telefono=3001234567", type: "application/x-www-form-urlencoded" })).status).toBe(202);
    await Promise.all(s.jobs.map((job) => job()));
    expect([...s.repository.webhooks.values()][0]!.sample).toEqual({ nombre: "Laura", telefono: "3001234567" });
    expect((await s.call(URL_OK, { method: "GET" })).status).toBe(405);
    expect((await s.call(URL_OK, { body: "123" })).status).toBe(400);
  });

  it("pasa de 600 envíos por minuto en un webhook: 429", async () => {
    const s = await setup();
    for (let i = 0; i < 600; i += 1) await s.call(URL_OK, { body: "{}" });
    await expect(s.call(URL_OK, { body: "{}" })).rejects.toBeInstanceOf(TooManyRequestsError);
  });
});
