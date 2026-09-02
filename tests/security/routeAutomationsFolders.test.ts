import { describe, expect, it } from "vitest";
import { routeAutomationsRequest } from "../../apps/api/routes/routeAutomationsRequest.js";
import { AccessError } from "../../platform/authorization/domain/AccessError.js";
import { makeContext } from "./helpers/access.js";
import {
  InMemoryAutomationRepo,
  makeRequest,
  makeResponse,
  makeServices
} from "./helpers/automationsRoute.js";

// ---------------------------------------------------------------------------
// POST /automations/folders — autorización y aislamiento por tenant.
//
// Crear una carpeta es una mutación: exige flows.write, igual que borrar o
// renombrar. Y el tenant sale SIEMPRE del contexto autenticado: si alguna vez
// se leyera del cuerpo, un actor podría sembrar carpetas en un tenant ajeno.
// ---------------------------------------------------------------------------

const FOLDERS_URL = new URL("http://localhost/automations/folders");

describe("routeAutomationsRequest — POST /automations/folders", () => {
  it("lanza AccessError (403) con solo flows.read", async () => {
    const services = makeServices(new InMemoryAutomationRepo());
    const context = makeContext({ scopes: ["flows.read"] });

    await expect(
      routeAutomationsRequest(
        makeRequest("POST", { name: "Ventas" }),
        makeResponse(),
        FOLDERS_URL,
        services,
        context
      )
    ).rejects.toThrow(AccessError);

    expect(services.createFolderService.execute).not.toHaveBeenCalled();
  });

  it("un actor sin ningún scope tampoco puede crear", async () => {
    const services = makeServices(new InMemoryAutomationRepo());
    const context = makeContext({ scopes: [] });

    await expect(
      routeAutomationsRequest(
        makeRequest("POST", { name: "Ventas" }),
        makeResponse(),
        FOLDERS_URL,
        services,
        context
      )
    ).rejects.toThrow(AccessError);

    expect(services.createFolderService.execute).not.toHaveBeenCalled();
  });

  it("crea en el tenant del contexto, nunca en el del cuerpo", async () => {
    const services = makeServices(new InMemoryAutomationRepo());
    const context = makeContext({ scopes: ["flows.read", "flows.write"] });

    const handled = await routeAutomationsRequest(
      makeRequest("POST", { name: "Ventas", tenantId: "otro-tenant" }),
      makeResponse(),
      FOLDERS_URL,
      services,
      context
    );

    expect(handled).toBe(true);
    expect(services.createFolderService.execute).toHaveBeenCalledWith("test-tenant", "Ventas");
  });

  it("no confunde /automations/folders con el id de un flow", async () => {
    const services = makeServices(new InMemoryAutomationRepo());
    const context = makeContext({ scopes: ["flows.read", "flows.write"] });

    await routeAutomationsRequest(
      makeRequest("POST", { name: "Ventas" }),
      makeResponse(),
      FOLDERS_URL,
      services,
      context
    );

    expect(services.deleteAutomationService.execute).not.toHaveBeenCalled();
    expect(services.createFolderService.execute).toHaveBeenCalledOnce();
  });
});
