import { describe, expect, it } from "vitest";
import { McpCredentialServices } from "../../domains/mcp/application/McpCredentialServices.js";
import { hashToken, requirePermissions, scopesOf } from "../../domains/mcp/domain/McpCredential.js";
import { InMemoryMcpCredentialRepository } from "../../infrastructure/persistence/memory/InMemoryMcpCredentialRepository.js";

// ---------------------------------------------------------------------------
// Credenciales de agentes de IA (MCP): permisos por área (Leona no los tiene),
// token entregado una sola vez y guardado solo como huella, vencimiento y
// revocación inmediatos.
// ---------------------------------------------------------------------------

const T = "11111111-1111-4111-8111-111111111111";

function setup(start = Date.parse("2026-11-09T12:00:00.000Z")) {
  const clock = { ms: start };
  const repository = new InMemoryMcpCredentialRepository();
  let ids = 0;
  let secrets = 0;
  const services = new McpCredentialServices({ repository, newId: () => `cred-${++ids}`, newSecret: () => `secreto${++secrets}xyz9`, now: () => new Date(clock.ms) });
  return { clock, repository, services };
}

describe("permisos de una credencial", () => {
  it("por área: ver o ver y editar, traducidos a los permisos internos", () => {
    expect([...scopesOf(requirePermissions({ flows: "read", contacts: "write", conversations: "read" }))].sort()).toEqual(["contacts.read", "contacts.write", "conversations.read", "flows.read"]);
  });

  it("rechaza áreas sin acceso, «editar» donde solo se puede ver y niveles inventados", () => {
    expect(() => requirePermissions({ flows: "none" })).toThrow(/al menos a un área/);
    expect(() => requirePermissions({ connections: "write" })).toThrow(/solo se puede ver/);
    expect(() => requirePermissions({ contacts: "admin" })).toThrow(/no válido/);
  });
});

describe("McpCredentialServices", () => {
  it("entrega el token una vez y guarda solo su huella y una pista", async () => {
    const { services, repository } = setup();
    const { credential, token } = await services.create(T, { name: "Claude de ventas", permissions: { contacts: "write" }, expiresInDays: 90 });
    expect(token).toBe("aur_mcp_secreto1xyz9");
    const stored = repository.credentials.get(credential.id)!;
    expect(JSON.stringify(stored)).not.toContain("secreto1");
    expect([stored.tokenHash, credential.hint, credential.expiresAt]).toEqual([hashToken(token), "••••xyz9", "2027-02-07T12:00:00.000Z"]);
    expect(await services.list(T)).toEqual([credential]);
  });

  it("autentica el token válido con sus permisos; otro formato, uno desconocido, vencido o revocado no entran", async () => {
    const { services, clock } = setup();
    const { credential, token } = await services.create(T, { name: "n8n", permissions: { flows: "read" }, expiresInDays: 30 });
    const access = await services.authenticate(token);
    expect(access).toMatchObject({ tenantId: T, credentialId: credential.id, credentialName: "n8n" });
    expect([...access!.scopes]).toEqual(["flows.read"]);
    expect(await services.authenticate("bfk_otro")).toBeNull();
    expect(await services.authenticate("aur_mcp_inventado")).toBeNull();

    clock.ms += 31 * 86_400_000;
    expect(await services.authenticate(token)).toBeNull();

    const other = await services.create(T, { name: "Cursor", permissions: { flows: "read" } });
    await services.revoke(T, other.credential.id);
    expect(await services.authenticate(other.token)).toBeNull();
    await expect(services.revoke("otra-cuenta", credential.id)).rejects.toThrow(/no existe/);
  });

  it("anota el último uso a lo sumo una vez por minuto", async () => {
    const { services, repository, clock } = setup();
    const { credential, token } = await services.create(T, { name: "n8n", permissions: { flows: "read" } });
    await services.authenticate(token);
    clock.ms += 30_000;
    await services.authenticate(token);
    expect(repository.credentials.get(credential.id)!.lastUsedAt).toBe("2026-11-09T12:00:00.000Z");
    clock.ms += 31_000;
    await services.authenticate(token);
    expect(repository.credentials.get(credential.id)!.lastUsedAt).toBe("2026-11-09T12:01:01.000Z");
  });

  it("valida nombre y vencimiento", async () => {
    const { services } = setup();
    await expect(services.create(T, { name: " ", permissions: { flows: "read" } })).rejects.toThrow(/nombre/);
    await expect(services.create(T, { name: "x", permissions: { flows: "read" }, expiresInDays: 7 })).rejects.toThrow(/vencimiento/);
  });
});
