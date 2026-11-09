import { describe, expect, it, vi } from "vitest";
import { Readable } from "node:stream";
import type { IncomingMessage } from "node:http";
import { routeConnectionsRequest } from "../../apps/api/routes/routeConnectionsRequest.js";
import { routeWhatsAppWebhooks } from "../../apps/api/routes/routeWhatsAppWebhooks.js";
import type { ConnectionsServices } from "../../apps/api/composition/composeConnectionsServices.js";
import { composeConnectionsServicesWith } from "../../apps/api/composition/composeConnectionsServices.js";
import { InMemoryConnectionRepository } from "../../infrastructure/persistence/memory/InMemoryConnectionRepository.js";
import { AccessError } from "../../platform/authorization/domain/AccessError.js";
import { ROLE_SCOPES } from "../../platform/authorization/roles/RoleDefinitions.js";
import { makeContext } from "./helpers/access.js";

// ---------------------------------------------------------------------------
// /connections: ver exige connections.read (todo el equipo); crear, vincular,
// renombrar y borrar, connections.write (dueños y administradores). El tenant
// sale del contexto: una cuenta nunca ve ni toca los números de otra.
// ---------------------------------------------------------------------------

const req = (method: string, path: string, body?: unknown) =>
  Object.assign(Readable.from(body ? [Buffer.from(JSON.stringify(body))] : []), { method, url: path, headers: {} }) as unknown as IncomingMessage;

function recorder() {
  const response = { statusCode: 0, body: "", setHeader() {}, end(chunk?: string) { response.body = chunk ?? ""; } };
  return response;
}

function services(): ConnectionsServices {
  return composeConnectionsServicesWith(new InMemoryConnectionRepository(), { keyRing: null, uazapi: null, webhookBaseUrl: null });
}

const run = async (s: ConnectionsServices, method: string, path: string, scopes: ReadonlyArray<string>, tenantId = "tenant-a", body?: unknown) => {
  const response = recorder();
  const handled = await routeConnectionsRequest(req(method, path, body), response as never, new URL(`http://x${path}`), s, makeContext({ scopes: [...scopes], tenantId }));
  return { handled, status: response.statusCode, body: response.body ? JSON.parse(response.body) : null };
};

describe("routeConnectionsRequest", () => {
  it("no atiende otras rutas", async () => {
    expect((await run(services(), "GET", "/contacts", ROLE_SCOPES.tenant_owner)).handled).toBe(false);
  });

  it("dueño: crea, renombra, vincula (sin proveedor: lo dice) y elimina", async () => {
    const s = services();
    const created = await run(s, "POST", "/connections", ROLE_SCOPES.tenant_owner, "tenant-a", { name: "Ventas", method: "qr" });
    expect(created.status).toBe(201);
    const id = created.body.id as string;
    expect((await run(s, "PATCH", `/connections/${id}`, ROLE_SCOPES.tenant_owner, "tenant-a", { name: "Soporte" })).body.name).toBe("Soporte");
    expect((await run(s, "POST", `/connections/${id}/link`, ROLE_SCOPES.tenant_owner)).body.state).toBe("unavailable");
    expect((await run(s, "DELETE", `/connections/${id}`, ROLE_SCOPES.tenant_owner)).status).toBe(204);
    expect((await run(s, "GET", "/connections", ROLE_SCOPES.tenant_owner)).body.connections).toEqual([]);
  });

  it("operador y lector ven la lista pero no pueden cambiarla", async () => {
    const s = services();
    for (const role of ["operator", "viewer"] as const) {
      expect((await run(s, "GET", "/connections", ROLE_SCOPES[role])).status).toBe(200);
      await expect(run(s, "POST", "/connections", ROLE_SCOPES[role], "tenant-a", { name: "X", method: "qr" })).rejects.toThrow(AccessError);
    }
  });

  it("sin connections.read no hay acceso", async () => {
    await expect(run(services(), "GET", "/connections", ["flows.read"])).rejects.toThrow(AccessError);
  });

  it("una cuenta no ve los números de otra", async () => {
    const s = services();
    await run(s, "POST", "/connections", ROLE_SCOPES.tenant_owner, "tenant-a", { name: "Ventas", method: "qr" });
    expect((await run(s, "GET", "/connections", ROLE_SCOPES.tenant_owner, "tenant-b")).body.connections).toEqual([]);
  });
});

describe("routeWhatsAppWebhooks (avisos de uazapi)", () => {
  const webhook = async (body: unknown, method = "POST") => {
    const execute = vi.fn(async () => true);
    const response = recorder();
    const handled = await routeWhatsAppWebhooks(req(method, "/webhooks/uazapi", body), response as never, new URL("http://x/webhooks/uazapi"), {
      providerEvents: { execute }
    } as unknown as ConnectionsServices);
    return { handled, status: response.statusCode, execute };
  };

  it("pasa el evento de conexión con el token y la conexión del nombre de la instancia", async () => {
    const { status, execute } = await webhook({
      EventType: "connection",
      owner: "573013815302",
      token: "inst-token",
      instanceName: "auream-c1",
      instance: { name: "auream-c1", status: "disconnected" },
      type: "Disconnected"
    });
    expect(status).toBe(200);
    expect(execute).toHaveBeenCalledWith({ connectionId: "c1", secret: "inst-token", status: "disconnected", phoneNumber: "573013815302" });
  });

  it("ignora otros eventos e instancias ajenas, y responde igual (no revela nada)", async () => {
    for (const body of [{ EventType: "messages" }, { EventType: "connection", instanceName: "otra-app", instance: { status: "connected" } }]) {
      const { status, execute } = await webhook(body);
      expect(status).toBe(200);
      expect(execute).not.toHaveBeenCalled();
    }
  });

  it("solo acepta POST y no atiende otras rutas", async () => {
    expect((await webhook({}, "GET")).status).toBe(405);
    const response = recorder();
    expect(await routeWhatsAppWebhooks(req("POST", "/otra"), response as never, new URL("http://x/otra"), {} as ConnectionsServices)).toBe(false);
  });
});

describe("routeConnectionsRequest · disparadores", () => {
  it("leer con connections.read; crear o cambiar exige connections.write", async () => {
    const s = services();
    const created = await run(s, "POST", "/connections", ROLE_SCOPES.tenant_owner, "tenant-a", { name: "Ventas", method: "qr" });
    const path = `/connections/${created.body.id}/triggers`;
    expect((await run(s, "GET", path, ROLE_SCOPES.viewer)).body).toEqual({ triggers: [] });
    await expect(run(s, "POST", path, ROLE_SCOPES.operator, "tenant-a", { type: "any_message", automationId: "x" })).rejects.toThrow(AccessError);
  });
});
