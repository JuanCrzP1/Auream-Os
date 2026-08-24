import { describe, expect, it, vi } from "vitest";
import type { IncomingMessage, ServerResponse } from "node:http";
import { routeAutomationsRequest } from "../../apps/api/routes/routeAutomationsRequest.js";
import type { ApiServices } from "../../apps/api/composition/composeBuilderServices.js";
import type { AutomationRepository } from "../../domains/automations/catalog/application/AutomationRepository.js";
import type { AutomationFlow } from "../../domains/automations/catalog/domain/AutomationFlow.js";
import { AccessError } from "../../platform/authorization/domain/AccessError.js";
import { makeContext } from "./helpers/access.js";

// ---------------------------------------------------------------------------
// routeAutomationsRequest — autorización por scope
//
// Regresión del hallazgo real: esta ruta llegó a producción sin ningún
// requireScope(), de modo que un actor con solo "flows.read" (p.ej. rol
// viewer) podía borrar y renombrar automatizaciones de su tenant. Este test
// falla si alguien vuelve a quitar el guard.
// ---------------------------------------------------------------------------

class InMemoryAutomationRepo implements AutomationRepository {
  private items: AutomationFlow[] = [];

  async findByTenant(tenantId: string) {
    return this.items.filter((f) => f.tenantId === tenantId);
  }
  async findById(tenantId: string, id: string) {
    return this.items.find((f) => f.tenantId === tenantId && f.id === id);
  }
  async save(flow: AutomationFlow) {
    const idx = this.items.findIndex((f) => f.tenantId === flow.tenantId && f.id === flow.id);
    if (idx >= 0) this.items[idx] = flow;
    else this.items.push(flow);
  }
  async delete(tenantId: string, id: string) {
    this.items = this.items.filter((f) => !(f.tenantId === tenantId && f.id === id));
  }
  seed(flow: AutomationFlow) {
    this.items.push(flow);
    return this;
  }
}

const SAMPLE_FLOW: AutomationFlow = {
  id: "flow-1",
  tenantId: "test-tenant",
  key: "flow-key-1",
  name: "Mi Flow",
  status: "draft",
  metadata: { createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" }
};

function makeServices(repo: AutomationRepository): ApiServices {
  return {
    listAutomationsService: { execute: vi.fn(async () => ({ flows: [], folders: [] })) },
    deleteAutomationService: { execute: vi.fn(async () => undefined) },
    automationRepository: repo
  } as unknown as ApiServices;
}

function makeRequest(method: string, body?: unknown): IncomingMessage {
  const chunks = body ? [Buffer.from(JSON.stringify(body))] : [];
  const request = {
    method,
    [Symbol.asyncIterator]: async function* () {
      for (const chunk of chunks) yield chunk;
    }
  };
  return request as unknown as IncomingMessage;
}

function makeResponse(): ServerResponse {
  const response = {
    statusCode: 0,
    setHeader() {},
    end() {}
  };
  return response as unknown as ServerResponse;
}

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
