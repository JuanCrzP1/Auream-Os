import { describe, expect, it } from "vitest";
import { routeAutomationsRequest } from "../../apps/api/routes/routeAutomationsRequest.js";
import { AccessError } from "../../platform/authorization/domain/AccessError.js";
import { makeContext } from "./helpers/access.js";
import {
  InMemoryAutomationRepo,
  SAMPLE_FLOW,
  makeRequest,
  makeResponse,
  makeServices
} from "./helpers/automationsRoute.js";

// ---------------------------------------------------------------------------
// routeAutomationsRequest — autorización por scope sobre flows.
//
// Regresión del hallazgo real: esta ruta llegó a producción sin ningún
// requireScope(), de modo que un actor con solo "flows.read" (p.ej. rol
// viewer) podía borrar y renombrar automatizaciones de su tenant. Este test
// falla si alguien vuelve a quitar el guard.
//
// La autorización de carpetas vive en routeAutomationsFolders.test.ts.
// ---------------------------------------------------------------------------

describe("routeAutomationsRequest — actor sin flows.write no puede mutar automatizaciones", () => {
  it("GET /automations tiene éxito con solo flows.read", async () => {
    const repo = new InMemoryAutomationRepo().seed(SAMPLE_FLOW);
    const services = makeServices(repo);
    const context = makeContext({ scopes: ["flows.read"] });

    const handled = await routeAutomationsRequest(
      makeRequest("GET"),
      makeResponse(),
      new URL("http://localhost/automations"),
      services,
      context
    );

    expect(handled).toBe(true);
    expect(services.listAutomationsService.execute).toHaveBeenCalledWith("test-tenant");
  });

  it("DELETE /automations/:id lanza AccessError (403) con solo flows.read", async () => {
    const repo = new InMemoryAutomationRepo().seed(SAMPLE_FLOW);
    const services = makeServices(repo);
    const context = makeContext({ scopes: ["flows.read"] });

    await expect(
      routeAutomationsRequest(
        makeRequest("DELETE"),
        makeResponse(),
        new URL("http://localhost/automations/flow-1"),
        services,
        context
      )
    ).rejects.toThrow(AccessError);

    expect(services.deleteAutomationService.execute).not.toHaveBeenCalled();
  });

  it("PATCH /automations/:id lanza AccessError (403) con solo flows.read", async () => {
    const repo = new InMemoryAutomationRepo().seed(SAMPLE_FLOW);
    const services = makeServices(repo);
    const context = makeContext({ scopes: ["flows.read"] });

    await expect(
      routeAutomationsRequest(
        makeRequest("PATCH", { name: "Nuevo nombre" }),
        makeResponse(),
        new URL("http://localhost/automations/flow-1"),
        services,
        context
      )
    ).rejects.toThrow(AccessError);

    const stored = await repo.findById("test-tenant", "flow-1");
    expect(stored?.name).toBe("Mi Flow");
  });

  it("un actor sin ningún scope no puede ni listar", async () => {
    const repo = new InMemoryAutomationRepo();
    const services = makeServices(repo);
    const context = makeContext({ scopes: [] });

    await expect(
      routeAutomationsRequest(
        makeRequest("GET"),
        makeResponse(),
        new URL("http://localhost/automations"),
        services,
        context
      )
    ).rejects.toThrow(AccessError);
  });

  it("DELETE /automations/:id tiene éxito cuando el actor sí tiene flows.write", async () => {
    const repo = new InMemoryAutomationRepo().seed(SAMPLE_FLOW);
    const services = makeServices(repo);
    const context = makeContext({ scopes: ["flows.read", "flows.write"] });

    const handled = await routeAutomationsRequest(
      makeRequest("DELETE"),
      makeResponse(),
      new URL("http://localhost/automations/flow-1"),
      services,
      context
    );

    expect(handled).toBe(true);
    expect(services.deleteAutomationService.execute).toHaveBeenCalledWith("test-tenant", "flow-1");
  });

  it("PATCH /automations/:id tiene éxito cuando el actor sí tiene flows.write", async () => {
    const repo = new InMemoryAutomationRepo().seed(SAMPLE_FLOW);
    const services = makeServices(repo);
    const context = makeContext({ scopes: ["flows.read", "flows.write"] });

    const handled = await routeAutomationsRequest(
      makeRequest("PATCH", { name: "Nuevo nombre" }),
      makeResponse(),
      new URL("http://localhost/automations/flow-1"),
      services,
      context
    );

    expect(handled).toBe(true);
    const stored = await repo.findById("test-tenant", "flow-1");
    expect(stored?.name).toBe("Nuevo nombre");
  });
});
