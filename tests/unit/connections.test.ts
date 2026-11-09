import { describe, expect, it, vi } from "vitest";
import {
  CreateConnectionService,
  DeleteConnectionService,
  LinkConnectionService,
  ListConnectionsService,
  RenameConnectionService
} from "../../domains/connections/application/ConnectionServices.js";
import { normalizeConnectionName, normalizePhoneNumber } from "../../domains/connections/domain/WhatsAppConnection.js";
import { InMemoryConnectionRepository } from "../../infrastructure/persistence/memory/InMemoryConnectionRepository.js";
import { UnconfiguredWhatsAppLinker } from "../../infrastructure/whatsapp/UnconfiguredWhatsAppLinker.js";
import type { LinkOutcome, WhatsAppLinker } from "../../domains/connections/application/ports/WhatsAppLinker.js";
import { ConflictError } from "../../platform/observability/errors/ConflictError.js";
import { NotFoundError } from "../../platform/observability/errors/NotFoundError.js";
import { ValidationError } from "../../platform/observability/errors/ValidationError.js";

// ---------------------------------------------------------------------------
// Conexiones de WhatsApp: crear (QR o API oficial), renombrar, eliminar
// cerrando la sesión y vincular sin fingir cuando no hay proveedor.
// ---------------------------------------------------------------------------

const T = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";

function setup(linker: WhatsAppLinker = new UnconfiguredWhatsAppLinker()) {
  const repository = new InMemoryConnectionRepository();
  return {
    repository,
    list: new ListConnectionsService(repository),
    create: new CreateConnectionService(repository),
    rename: new RenameConnectionService(repository),
    remove: new DeleteConnectionService(repository, linker),
    link: new LinkConnectionService(repository, linker)
  };
}

const fakeLinker = (outcome: LinkOutcome) => ({ link: vi.fn(async () => outcome), unlink: vi.fn(async () => undefined) });

describe("dominio", () => {
  it("normaliza nombres y teléfonos", () => {
    expect(normalizeConnectionName("  Ventas   Colombia ")).toBe("Ventas Colombia");
    expect(normalizeConnectionName("")).toBeNull();
    expect(normalizeConnectionName("x".repeat(41))).toBeNull();
    expect(normalizePhoneNumber("+57 301 381 5302")).toBe("573013815302");
    expect(normalizePhoneNumber("123")).toBeNull();
  });
});

describe("casos de uso", () => {
  it("crea una conexión pendiente por cuenta, con nombres únicos sin importar mayúsculas", async () => {
    const s = setup();
    const created = await s.create.execute(T, { name: "Ventas", method: "qr" });
    expect(created).toMatchObject({ name: "Ventas", method: "qr", status: "pending", phoneNumber: null });
    await expect(s.create.execute(T, { name: "ventas", method: "cloud_api" })).rejects.toThrow(ConflictError);
    await s.create.execute(OTHER, { name: "Ventas", method: "qr" });
    expect(await s.list.execute(T)).toHaveLength(1);
  });

  it("valida el método y el nombre", async () => {
    const s = setup();
    await expect(s.create.execute(T, { name: "A", method: "sms" as never })).rejects.toThrow(ValidationError);
    await expect(s.create.execute(T, { name: " ", method: "qr" })).rejects.toThrow(ValidationError);
  });

  it("renombra solo en su cuenta", async () => {
    const s = setup();
    const created = await s.create.execute(T, { name: "Ventas", method: "qr" });
    expect((await s.rename.execute(T, created.id, { name: "Soporte" })).name).toBe("Soporte");
    await expect(s.rename.execute(OTHER, created.id, { name: "X" })).rejects.toThrow(NotFoundError);
  });

  it("sin proveedor, vincular lo dice y no cambia el estado", async () => {
    const s = setup();
    const created = await s.create.execute(T, { name: "Ventas", method: "qr" });
    const state = await s.link.execute(T, created.id);
    expect(state.state).toBe("unavailable");
    expect(state.state === "unavailable" && state.message).toMatch(/código QR/);
    expect((await s.list.execute(T))[0]!.status).toBe("pending");
  });

  it("con proveedor: el QR deja la conexión «conectando»", async () => {
    const s = setup(fakeLinker({ kind: "qr", qrImage: "data:image/png;base64,AA", expiresAt: "2026-11-08T20:00:00.000Z", providerRef: "sess-1" }));
    const created = await s.create.execute(T, { name: "Ventas", method: "qr" });
    const state = await s.link.execute(T, created.id);
    expect(state).toMatchObject({ state: "qr", connection: { status: "connecting" } });
    expect(JSON.stringify(state)).not.toContain("sess-1");
  });

  it("con proveedor: al vincular guarda el número y el perfil", async () => {
    const s = setup(fakeLinker({ kind: "connected", phoneNumber: "573013815302", profileName: "Auream", providerRef: "sess-1" }));
    const created = await s.create.execute(T, { name: "Ventas", method: "qr" });
    const state = await s.link.execute(T, created.id);
    expect(state).toMatchObject({ state: "connected", connection: { status: "connected", phoneNumber: "573013815302", profileName: "Auream" } });
    expect(state.connection.lastConnectedAt).not.toBeNull();
  });

  it("eliminar cierra la sesión en el proveedor", async () => {
    const linker = fakeLinker({ kind: "unavailable", message: "x" });
    const s = setup(linker);
    const created = await s.create.execute(T, { name: "Ventas", method: "qr" });
    await s.remove.execute(T, created.id);
    expect(linker.unlink).toHaveBeenCalledTimes(1);
    expect(await s.list.execute(T)).toEqual([]);
    await expect(s.remove.execute(T, created.id)).rejects.toThrow(NotFoundError);
  });
});
