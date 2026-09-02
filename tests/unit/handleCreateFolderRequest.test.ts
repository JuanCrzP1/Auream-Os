import { describe, expect, it, vi } from "vitest";
import type { IncomingMessage, ServerResponse } from "node:http";
import { handleCreateFolderRequest } from "../../apps/api/handlers/handleCreateFolderRequest.js";
import { CreateFolderService } from "../../domains/automations/catalog/application/CreateFolderService.js";
import type { FolderRepository } from "../../domains/automations/catalog/application/FolderRepository.js";
import type { AutomationFolder } from "../../domains/automations/catalog/domain/AutomationFolder.js";

// ---------------------------------------------------------------------------
// handleCreateFolderRequest — contrato HTTP de `POST /automations/folders`.
//
// El caso de uso ya está probado en tests/unit/automations.test.ts; aquí sólo
// se comprueba la frontera HTTP: validación del cuerpo, código de estado y
// forma de la respuesta (que nunca debe filtrar tenantId ni createdAt).
// ---------------------------------------------------------------------------

class InMemoryFolderRepo implements FolderRepository {
  public readonly items: AutomationFolder[] = [];

  async findByTenant(tenantId: string) {
    return this.items.filter((f) => f.tenantId === tenantId);
  }
  async findById(tenantId: string, id: string) {
    return this.items.find((f) => f.tenantId === tenantId && f.id === id);
  }
  async save(folder: AutomationFolder) {
    this.items.push(folder);
  }
}

function makeRequest(body?: unknown): IncomingMessage {
  const chunks = body === undefined ? [] : [Buffer.from(JSON.stringify(body))];
  return {
    method: "POST",
    [Symbol.asyncIterator]: async function* () {
      for (const chunk of chunks) yield chunk;
    }
  } as unknown as IncomingMessage;
}

function makeResponse() {
  const sent: { status: number; body: unknown } = { status: 0, body: undefined };
  const response = {
    statusCode: 0,
    setHeader() {},
    end(payload: string) {
      sent.status = response.statusCode;
      sent.body = JSON.parse(payload);
    }
  };
  return { response: response as unknown as ServerResponse, sent };
}

describe("handleCreateFolderRequest", () => {
  it("crea la carpeta y responde 201 con el summary", async () => {
    const repo = new InMemoryFolderRepo();
    const { response, sent } = makeResponse();

    await handleCreateFolderRequest(
      makeRequest({ name: "Ventas" }),
      response,
      new CreateFolderService(repo),
      "tenant-1"
    );

    expect(sent.status).toBe(201);
    expect(sent.body).toMatchObject({ name: "Ventas" });
    expect(repo.items).toHaveLength(1);
    expect(repo.items[0]!.tenantId).toBe("tenant-1");
  });

  it("NUNCA expone tenantId ni createdAt al cliente", async () => {
    const { response, sent } = makeResponse();

    await handleCreateFolderRequest(
      makeRequest({ name: "Ventas" }),
      response,
      new CreateFolderService(new InMemoryFolderRepo()),
      "tenant-1"
    );

    expect(sent.body).not.toHaveProperty("tenantId");
    expect(sent.body).not.toHaveProperty("createdAt");
  });

  it("delega la validación del nombre en el dominio, no la reimplementa", async () => {
    const repo = new InMemoryFolderRepo();
    const { response } = makeResponse();

    // El handler no filtra el blanco: deja que la invariante del caso de uso
    // se propague como ValidationError (422) al manejador de errores del server.
    await expect(
      handleCreateFolderRequest(
        makeRequest({ name: "   " }),
        response,
        new CreateFolderService(repo),
        "tenant-1"
      )
    ).rejects.toMatchObject({ statusCode: 422 });

    expect(repo.items).toHaveLength(0);
  });

  it("rechaza con 400 un cuerpo que no cumple la forma del contrato", async () => {
    const repo = new InMemoryFolderRepo();
    const { response, sent } = makeResponse();
    const service = new CreateFolderService(repo);
    const spy = vi.spyOn(service, "execute");

    for (const body of [{}, { name: 42 }, { nombre: "Ventas" }]) {
      await handleCreateFolderRequest(makeRequest(body), response, service, "tenant-1");
      expect(sent.status).toBe(400);
    }

    expect(spy).not.toHaveBeenCalled();
  });
});
