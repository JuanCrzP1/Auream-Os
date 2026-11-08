import { describe, expect, it, vi } from "vitest";
import { Readable } from "node:stream";
import type { IncomingMessage } from "node:http";
import { routeBuilderApiRequest, type BuilderApiServices } from "../../apps/api/routes/routeBuilderApiRequest.js";
import { TestIntegrationRequestService } from "../../domains/automations/builder/application/TestIntegrationRequestService.js";
import { EngineIntegrationRequestTester } from "../../apps/api/composition/EngineIntegrationRequestTester.js";
import { InMemoryRateLimiter } from "../../platform/security/rate-limiting/application/InMemoryRateLimiter.js";
import { AccessError } from "../../platform/authorization/domain/AccessError.js";
import { ValidationError } from "../../platform/observability/errors/ValidationError.js";
import { TooManyRequestsError } from "../../platform/observability/errors/TooManyRequestsError.js";
import type { HttpRequester, OutboundHttpRequest } from "../../flow-engine/ports/HttpRequester.js";
import { makeContext } from "./helpers/access.js";

// ---------------------------------------------------------------------------
// «Probar» la Integración: exige flows.write, valida la entrada, limita las
// pruebas por cuenta y recorre el mismo código que el bloque en un flujo.
// ---------------------------------------------------------------------------

const URL_PATH = "/api/builder/integrations/test";

const post = (body: unknown) =>
  Object.assign(Readable.from([Buffer.from(JSON.stringify(body))]), { method: "POST", url: URL_PATH, headers: {} }) as unknown as IncomingMessage;

function recorder() {
  const response = { statusCode: 0, body: "", setHeader() {}, end(chunk?: string) { response.body = chunk ?? ""; } };
  return response;
}

class EchoHttp implements HttpRequester {
  public sent: OutboundHttpRequest[] = [];
  public async send(request: OutboundHttpRequest) {
    this.sent.push(request);
    return { ok: true as const, durationMs: 7, response: { status: 200, headers: { "content-type": "application/json" }, body: JSON.stringify({ lead: { id: 9, name: "x" } }) } };
  }
}

function setup(policy = { windowMs: 60_000, maxRequests: 20 }) {
  const http = new EchoHttp();
  const service = new TestIntegrationRequestService(new EngineIntegrationRequestTester(http), new InMemoryRateLimiter(), policy);
  return { http, services: { testIntegrationService: service } as unknown as BuilderApiServices };
}

const CONFIG = {
  method: "POST",
  url: "https://api.crm.test/leads",
  headers: [{ id: "h", key: "Content-Type", value: "application/json" }],
  body: '{"nombre":"{full_name}","ciudad":"{ciudad}"}',
  responseMappings: [{ id: "m", path: "lead.id", field: "id_crm" }]
};

describe("POST /api/builder/integrations/test", () => {
  it("con flows.write envía la petición con valores de ejemplo y devuelve lo que guardaría", async () => {
    const { http, services } = setup();
    const response = recorder();
    await routeBuilderApiRequest(post({ config: CONFIG, variables: { ciudad: "Cali" } }), response as never, services, makeContext({ scopes: ["flows.write"] }));

    expect(JSON.parse(http.sent[0]!.body!)).toEqual({ nombre: "Laura Gómez", ciudad: "Cali" });
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toMatchObject({
      succeeded: true,
      status: 200,
      paths: [{ path: "lead.id", preview: "9" }, { path: "lead.name", preview: "x" }],
      mapped: { id_crm: 9 },
      missingPaths: [],
      missingVariables: []
    });
  });

  it("sin flows.write se rechaza y no sale ninguna petición", async () => {
    const { http, services } = setup();
    await expect(routeBuilderApiRequest(post({ config: CONFIG }), recorder() as never, services, makeContext({ scopes: ["flows.read"] }))).rejects.toThrow(AccessError);
    expect(http.sent).toHaveLength(0);
  });

  it.each([
    ["sin configuración", {}],
    ["variables que no son texto", { config: CONFIG, variables: { a: 1 } }]
  ])("%s → 422", async (_case, body) => {
    const { services } = setup();
    await expect(routeBuilderApiRequest(post(body), recorder() as never, services, makeContext({ scopes: ["flows.write"] }))).rejects.toThrow(ValidationError);
  });

  it("limita las pruebas por cuenta (429)", async () => {
    const { http, services } = setup({ windowMs: 60_000, maxRequests: 2 });
    const run = () => routeBuilderApiRequest(post({ config: CONFIG }), recorder() as never, services, makeContext({ scopes: ["flows.write"] }));
    await run();
    await run();
    await expect(run()).rejects.toThrow(TooManyRequestsError);
    expect(http.sent).toHaveLength(2);
  });
});
