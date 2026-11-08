import { describe, expect, it } from "vitest";
import { routeAutomationsRequest } from "../../apps/api/routes/routeAutomationsRequest.js";
import { AccessError } from "../../platform/authorization/domain/AccessError.js";
import { makeContext } from "./helpers/access.js";
import { InMemoryAutomationRepo, SAMPLE_FLOW, makeRequest, makeResponse, makeServices } from "./helpers/automationsRoute.js";

// ---------------------------------------------------------------------------
// Crear, duplicar y archivar exigen flows.write (B10). Crear era el hueco: se
// hacía abriendo el builder con un GET, accesible con solo flows.read.
// ---------------------------------------------------------------------------

const CASES = [
  { name: "POST /automations (crear)", method: "POST", path: "/automations", body: {}, service: "createAutomationService" },
  { name: "POST /automations/:id/duplicate", method: "POST", path: "/automations/flow-1/duplicate", body: undefined, service: "duplicateAutomationService" },
  { name: "PATCH /automations/:id/archive", method: "PATCH", path: "/automations/flow-1/archive", body: { archived: true }, service: "setAutomationArchivedService" }
] as const;

describe("routeAutomationsRequest — ciclo de vida de una automatización", () => {
  for (const c of CASES) {
    it(`${c.name}: AccessError con solo flows.read, sin llegar al caso de uso`, async () => {
      const services = makeServices(new InMemoryAutomationRepo().seed(SAMPLE_FLOW));

      await expect(
        routeAutomationsRequest(makeRequest(c.method, c.body), makeResponse(), new URL(`http://localhost${c.path}`), services, makeContext({ scopes: ["flows.read"] }))
      ).rejects.toThrow(AccessError);

      expect((services as unknown as Record<string, { execute: { mock: { calls: unknown[] } } }>)[c.service]!.execute.mock.calls).toHaveLength(0);
    });

    it(`${c.name}: con flows.write llega al caso de uso con el tenant del contexto`, async () => {
      const services = makeServices(new InMemoryAutomationRepo().seed(SAMPLE_FLOW));
      const response = makeResponse();

      const handled = await routeAutomationsRequest(
        makeRequest(c.method, c.body), response, new URL(`http://localhost${c.path}`), services, makeContext({ scopes: ["flows.read", "flows.write"] })
      );

      expect(handled).toBe(true);
      const calls = (services as unknown as Record<string, { execute: { mock: { calls: unknown[][] } } }>)[c.service]!.execute.mock.calls;
      expect(calls[0]?.[0]).toBe("test-tenant");
    });
  }

  it("archivar sin un booleano responde 400 y no toca nada", async () => {
    const services = makeServices(new InMemoryAutomationRepo().seed(SAMPLE_FLOW));
    const response = makeResponse();

    await routeAutomationsRequest(makeRequest("PATCH", { archived: "si" }), response, new URL("http://localhost/automations/flow-1/archive"), services, makeContext({ scopes: ["flows.write"] }));

    expect(response.statusCode).toBe(400);
    expect(services.setAutomationArchivedService.execute).not.toHaveBeenCalled();
  });
});
