import { vi } from "vitest";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { ApiServices } from "../../../apps/api/composition/composeBuilderServices.js";
import type { AutomationRepository } from "../../../domains/automations/catalog/application/AutomationRepository.js";
import type { AutomationFlow } from "../../../domains/automations/catalog/domain/AutomationFlow.js";

// ---------------------------------------------------------------------------
// Dobles compartidos por los tests de autorización de `/automations`.
//
// Responsabilidad única: construir el entorno mínimo (repo, servicios,
// request, response) con el que ejercitar routeAutomationsRequest.
// ---------------------------------------------------------------------------

export class InMemoryAutomationRepo implements AutomationRepository {
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

export const SAMPLE_FLOW: AutomationFlow = {
  id: "flow-1",
  tenantId: "test-tenant",
  key: "flow-key-1",
  name: "Mi Flow",
  status: "draft",
  metadata: { createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" }
};

export function makeServices(repo: AutomationRepository): ApiServices {
  return {
    listAutomationsService: { execute: vi.fn(async () => ({ flows: [], folders: [] })) },
    deleteAutomationService: { execute: vi.fn(async () => undefined) },
    createFolderService: {
      execute: vi.fn(async (tenantId: string, name: string) => ({
        id: "folder-1",
        tenantId,
        name,
        createdAt: "2026-01-01T00:00:00.000Z"
      }))
    },
    automationRepository: repo
  } as unknown as ApiServices;
}

export function makeRequest(method: string, body?: unknown): IncomingMessage {
  const chunks = body ? [Buffer.from(JSON.stringify(body))] : [];
  const request = {
    method,
    [Symbol.asyncIterator]: async function* () {
      for (const chunk of chunks) yield chunk;
    }
  };
  return request as unknown as IncomingMessage;
}

export function makeResponse(): ServerResponse {
  const response = {
    statusCode: 0,
    setHeader() {},
    end() {}
  };
  return response as unknown as ServerResponse;
}
