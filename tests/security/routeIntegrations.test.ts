import { describe, expect, it, vi } from "vitest";
import { Readable } from "node:stream";
import type { IncomingMessage } from "node:http";
import { routeIntegrationsRequest } from "../../apps/api/routes/routeIntegrationsRequest.js";
import type { IntegrationsServices } from "../../apps/api/composition/composeIntegrationsServices.js";
import { routeBuilderApiRequest, type BuilderApiServices } from "../../apps/api/routes/routeBuilderApiRequest.js";
import { TestAiStepService } from "../../domains/automations/builder/application/TestAiStepService.js";
import { EngineAiStepTester } from "../../apps/api/composition/EngineAiStepTester.js";
import { InMemoryRateLimiter } from "../../platform/security/rate-limiting/application/InMemoryRateLimiter.js";
import { AccessError } from "../../platform/authorization/domain/AccessError.js";
import { TooManyRequestsError } from "../../platform/observability/errors/TooManyRequestsError.js";
import { ROLE_SCOPES } from "../../platform/authorization/roles/RoleDefinitions.js";
import type { AiGateway } from "../../flow-engine/ports/AiGateway.js";
import { makeContext } from "./helpers/access.js";

// ---------------------------------------------------------------------------
// /ai-credentials: ver exige credentials.read; conectar, cambiar, verificar y
// borrar, credentials.write (dueños y administradores). Sin almacén de
// cifrado: 503. Y «Probar» la IA, con su límite por cuenta.
// ---------------------------------------------------------------------------

const req = (method: string, path: string, body?: unknown) =>
  Object.assign(Readable.from(body ? [Buffer.from(JSON.stringify(body))] : []), { method, url: path, headers: {} }) as unknown as IncomingMessage;

function recorder() {
  const response = { statusCode: 0, body: "", setHeader() {}, end(chunk?: string) { response.body = chunk ?? ""; } };
  return response;
}

function services() {
  const summary = { id: "c1", provider: "openai", name: "A", hint: "••••abcd", status: "active", lastVerifiedAt: null, createdAt: "x" };
  const fn = () => ({ execute: vi.fn(async () => summary) });
  const ai = { list: { execute: vi.fn(async () => [summary]) }, create: fn(), update: fn(), remove: { execute: vi.fn(async () => undefined) }, verify: fn(), listModels: { execute: vi.fn(async () => []) } };
  return { ai, services: { aiCredentials: ai, aiGateway: {} } as unknown as IntegrationsServices };
}

const run = (method: string, path: string, scopes: string[], s = services().services, body?: unknown) => {
  const response = recorder();
  return routeIntegrationsRequest(req(method, path, body), response as never, new URL(`http://x${path}`), s, makeContext({ scopes })).then((handled) => ({ handled, response }));
};

describe("routeIntegrationsRequest — permisos", () => {
  it.each([["GET", "/ai-credentials"], ["GET", "/ai-credentials/c1/models"]])("%s %s con credentials.read", async (method, path) => {
    const { handled, response } = await run(method, path, ["credentials.read"]);
    expect([handled, response.statusCode]).toEqual([true, 200]);
  });

  it.each([
    ["POST", "/ai-credentials", { provider: "openai", name: "A", apiKey: "sk-x" }],
    ["PATCH", "/ai-credentials/c1", { name: "B" }],
    ["DELETE", "/ai-credentials/c1", undefined],
    ["POST", "/ai-credentials/c1/verify", undefined]
  ])("%s %s sin credentials.write se rechaza", async (method, path, body) => {
    await expect(run(method, path, ["credentials.read"], services().services, body)).rejects.toThrow(AccessError);
  });

  it("leer sin credentials.read se rechaza", async () => {
    await expect(run("GET", "/ai-credentials", ["flows.read"])).rejects.toThrow(AccessError);
  });

  it("el tenant sale del contexto, no de la petición", async () => {
    const { ai, services: s } = services();
    await run("POST", "/ai-credentials", ["credentials.write"], s, { provider: "openai", name: "A", apiKey: "sk-x", tenantId: "otro" });
    expect(ai.create.execute.mock.calls[0]?.[0]).toBe("test-tenant");
  });

  it("sin almacén de cifrado responde 503", async () => {
    const { response } = await run("GET", "/ai-credentials", ["credentials.read"], { aiCredentials: null, aiGateway: {} } as unknown as IntegrationsServices);
    expect(response.statusCode).toBe(503);
  });

  it("no toca rutas que no son suyas", async () => {
    const { handled } = await run("GET", "/contacts", []);
    expect(handled).toBe(false);
  });

  it("roles: dueños y administradores administran; operadores solo eligen; lectores no ven", () => {
    expect(ROLE_SCOPES.tenant_owner).toEqual(expect.arrayContaining(["credentials.read", "credentials.write"]));
    expect(ROLE_SCOPES.tenant_admin).toEqual(expect.arrayContaining(["credentials.read", "credentials.write"]));
    expect(ROLE_SCOPES.operator).toContain("credentials.read");
    expect(ROLE_SCOPES.operator).not.toContain("credentials.write");
    expect(ROLE_SCOPES.viewer).not.toContain("credentials.read");
  });
});

describe("POST /api/builder/ai/test", () => {
  const ai: AiGateway = { generate: vi.fn(async () => ({ ok: true as const, text: "Hola Laura" })) };
  const builder = (max = 10) =>
    ({ testAiService: new TestAiStepService(new EngineAiStepTester(ai), new InMemoryRateLimiter(), { windowMs: 60_000, maxRequests: max }) }) as unknown as BuilderApiServices;
  const body = { config: { credentialId: "c1", model: "gpt-5.4-mini", systemPrompt: "Saluda a {first_name}" }, message: "hola" };

  it("con flows.write prueba el bloque con el mensaje dado", async () => {
    const response = recorder();
    await routeBuilderApiRequest(req("POST", "/api/builder/ai/test", body), response as never, builder(), makeContext({ scopes: ["flows.write"] }));
    expect(JSON.parse(response.body)).toMatchObject({ succeeded: true, reply: "Hola Laura", output: "success" });
    expect(vi.mocked(ai.generate).mock.calls[0]?.[1]).toMatchObject({ system: "Saluda a Laura", messages: [{ role: "user", content: "hola" }] });
  });

  it("sin flows.write se rechaza; y limita las pruebas por cuenta", async () => {
    await expect(routeBuilderApiRequest(req("POST", "/api/builder/ai/test", body), recorder() as never, builder(), makeContext({ scopes: ["flows.read"] }))).rejects.toThrow(AccessError);
    const s = builder(1);
    await routeBuilderApiRequest(req("POST", "/api/builder/ai/test", body), recorder() as never, s, makeContext({ scopes: ["flows.write"] }));
    await expect(routeBuilderApiRequest(req("POST", "/api/builder/ai/test", body), recorder() as never, s, makeContext({ scopes: ["flows.write"] }))).rejects.toThrow(TooManyRequestsError);
  });
});
