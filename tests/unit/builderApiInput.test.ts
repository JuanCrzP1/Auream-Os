import { describe, expect, it, vi } from "vitest";
import { Readable } from "node:stream";
import type { IncomingMessage, ServerResponse } from "node:http";
import { parseJsonBody, BodyTooLargeError, MalformedBodyError } from "../../apps/api/http/parseJsonBody.js";
import { isBuilderFlowSnapshot } from "../../domains/automations/builder/application/isBuilderFlowSnapshot.js";
import { handleSaveDraftRequest } from "../../apps/api/handlers/handleSaveDraftRequest.js";
import { routeBuilderApiRequest } from "../../apps/api/routes/routeBuilderApiRequest.js";
import { SaveDraftService } from "../../domains/automations/builder/application/SaveDraftService.js";
import { DirectUnitOfWork } from "../../domains/automations/builder/application/AutomationsUnitOfWork.js";
import { buildInitialBuilderWorkspace } from "../../apps/api/composition/buildInitialBuilderWorkspace.js";
import type { PersistedBuilderWorkspace } from "../../contracts/BuilderContracts.js";

// ---------------------------------------------------------------------------
// Entrada de la API del builder (FASE C4): tamaño, JSON, forma del flujo y
// del identificador, revisión base e identidad del flujo.
// ---------------------------------------------------------------------------

const requestWith = (body: string | Buffer, method = "PUT", url = "/") =>
  Object.assign(Readable.from([Buffer.isBuffer(body) ? body : Buffer.from(body)]), { method, url, headers: {} }) as unknown as IncomingMessage;

function responseRecorder() {
  const response = { statusCode: 0, body: "", setHeader() {}, end(chunk?: string) { response.body = chunk ?? ""; } };
  return response;
}

describe("parseJsonBody", () => {
  it("rechaza un cuerpo que supera el tope (413) sin leerlo entero", async () => {
    await expect(parseJsonBody(requestWith(Buffer.alloc(32, "a")), 16)).rejects.toBeInstanceOf(BodyTooLargeError);
  });

  it("rechaza JSON inválido con 400, no con un 500", async () => {
    const error = await parseJsonBody(requestWith("{no es json")).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(MalformedBodyError);
    expect((error as MalformedBodyError).statusCode).toBe(400);
  });
});

describe("isBuilderFlowSnapshot", () => {
  const valid = buildInitialBuilderWorkspace("t", "f").draft;

  it("acepta un borrador bien formado", () => {
    expect(isBuilderFlowSnapshot(valid)).toBe(true);
  });

  it.each([
    ["nulo", null],
    ["sin nodos", { ...valid, nodes: undefined }],
    ["nodo sin config", { ...valid, nodes: { x: { id: "x", type: "message", name: "x", content: {}, metadata: {} } } }],
    ["conexiones que no son lista", { ...valid, edgesBySource: { start: "nope" } }],
    ["sin entrada", { ...valid, version: { ...valid.version, entryNodeId: 3 } }]
  ])("rechaza: %s", (_label, value) => {
    expect(isBuilderFlowSnapshot(value)).toBe(false);
  });
});

describe("guardar borrador — entrada", () => {
  const workspace = buildInitialBuilderWorkspace("t", "flow-1");
  const getWorkspaceService = { execute: vi.fn(async () => workspace) };
  const saveDraftService = { execute: vi.fn(async (ws: PersistedBuilderWorkspace) => ws) };

  async function save(body: unknown) {
    const response = responseRecorder();
    await handleSaveDraftRequest(requestWith(JSON.stringify(body)), response as unknown as ServerResponse, getWorkspaceService as never, saveDraftService as never, "t", "flow-1");
    return response;
  }

  it("un cuerpo sin forma de flujo es 400 y no llega al caso de uso", async () => {
    saveDraftService.execute.mockClear();
    expect((await save({ draft: { nodes: [] } })).statusCode).toBe(400);
    expect(saveDraftService.execute).not.toHaveBeenCalled();
  });

  it("una revisión base que no es un entero >= 0 es 400", async () => {
    expect((await save({ draft: workspace.draft, baseRevision: -1 })).statusCode).toBe(400);
    expect((await save({ draft: workspace.draft, baseRevision: "3" })).statusCode).toBe(400);
  });

  it("pasa la revisión base al caso de uso", async () => {
    saveDraftService.execute.mockClear();
    await save({ draft: workspace.draft, baseRevision: 0 });
    expect(saveDraftService.execute).toHaveBeenCalledWith(workspace, workspace.draft, { baseRevision: 0 });
  });
});

describe("rutas del builder — identificador", () => {
  it("un flowKey con caracteres no permitidos es 400", async () => {
    const response = responseRecorder();
    await routeBuilderApiRequest(
      { method: "GET", url: "/api/builder/flows/..%2F..%2Fetc/workspace", headers: {} } as unknown as IncomingMessage,
      response as unknown as ServerResponse,
      {} as never,
      { tenantId: "t", scopes: ["flows.read"] } as never
    );
    expect(response.statusCode).toBe(400);
  });
});

describe("SaveDraftService — identidad y revisión", () => {
  function service() {
    const saved: PersistedBuilderWorkspace[] = [];
    const repos = {
      automations: { findById: async () => undefined, findByTenant: async () => [], save: async () => {}, delete: async () => {} },
      folders: { findById: async () => undefined, findByTenant: async () => [], save: async () => {} },
      workspaces: { getWorkspace: async () => null, getWorkspaces: async () => [], saveWorkspace: async (ws: PersistedBuilderWorkspace) => { saved.push(ws); }, deleteWorkspace: async () => {} }
    };
    return { sut: new SaveDraftService(new DirectUnitOfWork(repos)), saved };
  }

  it("un borrador que dice ser de otro flujo se guarda con la identidad del flujo abierto", async () => {
    const { sut, saved } = service();
    const workspace = buildInitialBuilderWorkspace("t", "mio");
    const impostor = { ...workspace.draft, flow: { id: "ajeno", key: "ajeno", name: "Nombre" } };

    await sut.execute(workspace, impostor);

    expect(saved[0]!.draft.flow).toMatchObject({ id: "mio", key: "mio", name: "Nombre" });
    expect(saved[0]!.flowKey).toBe("mio");
  });

  it("una revisión base vieja se rechaza con 409 sin escribir", async () => {
    const { sut, saved } = service();
    const workspace = { ...buildInitialBuilderWorkspace("t", "mio"), autosaveRevision: 5 };

    await expect(sut.execute(workspace, workspace.draft, { baseRevision: 4 })).rejects.toMatchObject({ statusCode: 409 });
    expect(saved).toHaveLength(0);
  });
});
