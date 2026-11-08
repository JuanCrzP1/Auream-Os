import { describe, expect, it } from "vitest";
import { buildIntegrationRequest } from "../../flow-engine/nodes/integration/buildIntegrationRequest.js";
import { listResponsePaths, readResponsePath } from "../../flow-engine/nodes/integration/responsePaths.js";
import { mapResponseFields, runIntegrationRequest } from "../../flow-engine/nodes/integration/runIntegrationRequest.js";
import { IntegrationNodeHandler } from "../../flow-engine/nodes/integration/IntegrationNodeHandler.js";
import { readIntegrationConfig, type IntegrationConfig } from "../../contracts/IntegrationConfig.js";
import type { HttpRequester, HttpSendResult, OutboundHttpRequest, OutboundHttpResponse } from "../../flow-engine/ports/HttpRequester.js";
import type { FlowNode } from "../../contracts/FlowSnapshot.js";
import type { RuntimeInput, Session } from "../../contracts/RuntimeContracts.js";
import { simulationDependencies } from "../../apps/api/composition/composeNodeRuntime.js";

// ---------------------------------------------------------------------------
// Bloque Integración: petición con variables bien codificadas, lectura de la
// respuesta por ruta, mapeo a campos del contacto y salida Éxito / Error.
// ---------------------------------------------------------------------------

const config = (overrides: Partial<IntegrationConfig> = {}): IntegrationConfig => ({
  ...readIntegrationConfig({}),
  url: "https://api.crm.test/leads",
  headers: [],
  body: "",
  ...overrides
});
const vars: Record<string, string> = { full_name: 'Ana "A" Pérez', phone: "573001112233", city: "San José" };
const resolve = (name: string) => vars[name];

describe("buildIntegrationRequest", () => {
  it("codifica las variables de la URL y conserva la estructura", () => {
    const built = buildIntegrationRequest(config({ method: "GET", url: "https://api.crm.test/buscar?ciudad={city}&tel={phone}" }), resolve);
    expect(built.ok && built.request.url).toBe("https://api.crm.test/buscar?ciudad=San%20Jos%C3%A9&tel=573001112233");
  });

  it("un valor con comillas no rompe el JSON del cuerpo", () => {
    const built = buildIntegrationRequest(
      config({ headers: [{ id: "h", key: "Content-Type", value: "application/json" }], body: '{"nombre":"{full_name}"}' }),
      resolve
    );
    expect(built.ok && JSON.parse(built.request.body!)).toEqual({ nombre: 'Ana "A" Pérez' });
  });

  it("sin Content-Type, un cuerpo JSON se marca como JSON", () => {
    const built = buildIntegrationRequest(config({ body: '{"t":"{phone}"}' }), resolve);
    expect(built.ok && built.request.headers["content-type"]).toBe("application/json");
  });

  it("GET y DELETE no envían cuerpo", () => {
    const built = buildIntegrationRequest(config({ method: "GET", body: '{"a":1}' }), resolve);
    expect(built.ok && built.request.body).toBeUndefined();
  });

  it("ignora cabeceras que gestiona el cliente y no permite inyectar otras", () => {
    const built = buildIntegrationRequest(
      config({
        headers: [
          { id: "1", key: "Host", value: "interno" },
          { id: "2", key: "X-Name", value: "{full_name}\r\nX-Evil: 1" }
        ]
      }),
      (name) => (name === "full_name" ? "Ana\r\nX-Evil: 1" : undefined)
    );
    expect(built.ok && built.request.headers).toEqual({ "x-name": "Ana X-Evil: 1 X-Evil: 1", "user-agent": "Auream-Integrations/1.0" });
  });

  it.each([
    ["sin protocolo http", "ftp://x.test/a", "invalid_url"],
    ["no es URL", "{nada}", "invalid_url"],
    ["con usuario y clave", "https://u:p@x.test/", "invalid_url"]
  ])("rechaza una URL %s", (_case, url, reason) => {
    const built = buildIntegrationRequest(config({ url }), resolve);
    expect(built.ok ? null : built.reason).toBe(reason);
  });

  it("rechaza un nombre de cabecera inválido", () => {
    const built = buildIntegrationRequest(config({ headers: [{ id: "1", key: "Mal Nombre", value: "x" }] }), resolve);
    expect(built.ok ? null : built.reason).toBe("invalid_header");
  });

  it("informa las variables sin valor", () => {
    const built = buildIntegrationRequest(config({ url: "https://x.test/{falta}" }), resolve);
    expect(built.ok && built.missingVariables).toEqual(["falta"]);
  });
});

const response = (body: unknown, status = 200, headers: Record<string, string> = {}): OutboundHttpResponse => ({
  status,
  headers: { "content-type": "application/json", ...headers },
  body: typeof body === "string" ? body : JSON.stringify(body)
});

describe("rutas en la respuesta", () => {
  const res = response({ data: { id: 42, items: [{ sku: "A1" }], ok: true, nada: null } }, 201, { location: "/leads/42" });
  const json = JSON.parse(res.body) as unknown;

  it.each([
    ["data.id", 42],
    ["body.data.id", 42],
    ["data.items[0].sku", "A1"],
    ["data.items.0.sku", "A1"],
    ["status", 201],
    ["headers.location", "/leads/42"],
    ["headers.Location", "/leads/42"]
  ])("%s → %j", (path, value) => {
    expect(readResponsePath(res, json, path)).toEqual({ found: true, value });
  });

  it.each(["data.otro", "data.items[3].sku", "data.id.x", "constructor", "data.items[x]"])("%s no existe", (path) => {
    expect(readResponsePath(res, json, path).found).toBe(false);
  });

  it("lista las rutas de valores simples para elegir", () => {
    expect(listResponsePaths(json).map((p) => p.path)).toEqual(["data.id", "data.items[0].sku", "data.ok", "data.nada"]);
  });

  it("mapea a campos: convierte, omite lo vacío y rechaza nombres inválidos", () => {
    const mapped = mapResponseFields(
      [
        { id: "1", path: "data.id", field: "id_crm" },
        { id: "2", path: "data.items", field: "items" },
        { id: "3", path: "data.nada", field: "nada" },
        { id: "4", path: "data.id", field: "mal campo" }
      ],
      res,
      json
    );
    expect(mapped).toEqual({ fields: { id_crm: 42, items: '[{"sku":"A1"}]' }, missingPaths: ["data.nada"], invalidFields: ["mal campo"] });
  });
});

class FakeHttp implements HttpRequester {
  public sent: OutboundHttpRequest[] = [];
  public constructor(private readonly result: HttpSendResult) {}
  public async send(request: OutboundHttpRequest) {
    this.sent.push(request);
    return this.result;
  }
}

describe("runIntegrationRequest", () => {
  it("2xx es éxito; 4xx/5xx es fallo http_error con la respuesta", async () => {
    const ok = await runIntegrationRequest(config(), resolve, new FakeHttp({ ok: true, response: response({ id: 1 }), durationMs: 5 }));
    const ko = await runIntegrationRequest(config(), resolve, new FakeHttp({ ok: true, response: response({ error: "x" }, 500), durationMs: 5 }));
    expect([ok.succeeded, ok.json]).toEqual([true, { id: 1 }]);
    expect([ko.succeeded, ko.reason, ko.response?.status]).toEqual([false, "http_error", 500]);
  });

  it("una petición imposible no llega a la red", async () => {
    const http = new FakeHttp({ ok: true, response: response({}), durationMs: 1 });
    const run = await runIntegrationRequest(config({ url: "" }), resolve, http);
    expect([run.succeeded, run.reason, http.sent.length]).toEqual([false, "invalid_url", 0]);
  });
});

describe("IntegrationNodeHandler", () => {
  const node = (cfg: Partial<IntegrationConfig>): FlowNode =>
    ({ id: "int", type: "integration", name: "CRM", content: {}, config: { ...config(cfg) }, metadata: {} }) as unknown as FlowNode;
  const input: RuntimeInput = {
    envelope: { tenantId: "t", flowKey: "f", channel: "whatsapp", conversationKey: "c", userKey: "573001112233", messageId: "m", payload: { text: "hola" }, receivedAt: "2026-11-08T00:00:00.000Z" },
    sessionContext: {},
    isWaitingInput: false,
    now: "2026-11-08T00:00:00.000Z",
    timezone: "UTC"
  };
  const session = { tenantId: "t" } as Session;

  it("éxito: envía con datos del contacto, guarda lo mapeado y sale por Éxito", async () => {
    const deps = simulationDependencies();
    const http = new FakeHttp({ ok: true, response: response({ lead: { id: "L-9" } }, 201), durationMs: 12 });
    const result = await new IntegrationNodeHandler(http, deps.contacts).execute(
      node({ body: '{"tel":"{phone}"}', responseMappings: [{ id: "m", path: "lead.id", field: "id_crm" }, { id: "n", path: "lead.no", field: "otro" }] }),
      input,
      session
    );

    expect(JSON.parse(http.sent[0]!.body!)).toEqual({ tel: "573001112233" });
    expect(result.output).toBe("success");
    expect(result.contextPatch).toEqual({ id_crm: "L-9" });
    expect(result.nodeResult).toMatchObject({ host: "api.crm.test", status: 201, savedFields: ["id_crm"], missingPaths: ["lead.no"] });
    expect(result.domainEvents).toEqual(["integration_succeeded:int:201", "integration_path_not_found:int:lead.no"]);
    const contact = await deps.contacts.resolve("t", { channel: "whatsapp", externalKey: "573001112233" });
    expect(contact.fields).toEqual({ id_crm: "L-9" });
  });

  it("sin respuesta: sale por Error con el motivo y sin tocar el contacto", async () => {
    const deps = simulationDependencies();
    const result = await new IntegrationNodeHandler(
      new FakeHttp({ ok: false, reason: "timeout", message: "El servicio no respondió a tiempo.", durationMs: 10000 }),
      deps.contacts
    ).execute(node({ responseMappings: [{ id: "m", path: "id", field: "id_crm" }] }), input, session);

    expect(result.executionStatus).toBe("success");
    expect(result.output).toBe("failure");
    expect(result.nodeResult).toMatchObject({ reason: "timeout", durationMs: 10000 });
    expect(result.domainEvents).toEqual(["integration_failed:int:timeout"]);
  });

  it("el resultado no expone cabeceras ni cuerpo enviados (pueden llevar credenciales)", async () => {
    const result = await new IntegrationNodeHandler(
      new FakeHttp({ ok: true, response: response({}, 200), durationMs: 1 }),
      simulationDependencies().contacts
    ).execute(node({ headers: [{ id: "a", key: "Authorization", value: "Bearer SECRETO" }] }), input, session);

    expect(JSON.stringify(result)).not.toContain("SECRETO");
  });

  it("en simulación sin red sale por Error («no disponible»)", async () => {
    const deps = simulationDependencies();
    const result = await new IntegrationNodeHandler(deps.http, deps.contacts).execute(node({}), input, session);
    expect([result.output, result.nodeResult["reason"]]).toEqual(["failure", "unavailable"]);
  });
});
