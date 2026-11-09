import { describe, expect, it, vi } from "vitest";
import { randomBytes } from "node:crypto";
import { normalizeConnectionName, normalizePhoneNumber } from "../../domains/connections/domain/WhatsAppConnection.js";
import { InMemoryConnectionRepository } from "../../infrastructure/persistence/memory/InMemoryConnectionRepository.js";
import { composeConnectionsServicesWith } from "../../apps/api/composition/composeConnectionsServices.js";
import { LinkersByMethod } from "../../infrastructure/whatsapp/LinkersByMethod.js";
import { UnconfiguredWhatsAppLinker } from "../../infrastructure/whatsapp/UnconfiguredWhatsAppLinker.js";
import { AesGcmSecretCipher } from "../../platform/security/secrets/AesGcmSecretCipher.js";
import {
  CheckConnectionService,
  CreateConnectionService,
  DeleteConnectionService,
  HandleProviderEventService,
  LinkConnectionService,
  ListConnectionsService,
  RenameConnectionService
} from "../../domains/connections/application/ConnectionServices.js";
import { LinkerError, type SessionState, type StartOutcome, type WhatsAppLinker } from "../../domains/connections/application/ports/WhatsAppLinker.js";
import { ConflictError } from "../../platform/observability/errors/ConflictError.js";
import { NotFoundError } from "../../platform/observability/errors/NotFoundError.js";
import { UpstreamError } from "../../platform/observability/errors/UpstreamError.js";
import { ValidationError } from "../../platform/observability/errors/ValidationError.js";

// ---------------------------------------------------------------------------
// Conexiones de WhatsApp: crear, renombrar, vincular por QR (el token de la
// sesión, cifrado), seguir la vinculación, eliminar cerrando la sesión y los
// avisos del proveedor, que solo valen con el token de ESA conexión.
// ---------------------------------------------------------------------------

const T = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const TOKEN = "instancia-token-secreto-123";

function fakeLinker(start: StartOutcome, checks: SessionState[] = []) {
  const queue = [...checks];
  return {
    start: vi.fn(async () => start),
    restart: vi.fn(async () => ({ kind: "qr", qrImage: "data:image/png;base64,NUEVO" }) as SessionState),
    refresh: vi.fn(async () => undefined),
    check: vi.fn(async () => queue.shift() ?? ({ kind: "disconnected" } as SessionState)),
    disconnect: vi.fn(async () => undefined),
    reset: vi.fn(async () => undefined),
    unlink: vi.fn(async () => undefined)
  } satisfies WhatsAppLinker;
}

function setup(qr: WhatsAppLinker = new UnconfiguredWhatsAppLinker()) {
  const repository = new InMemoryConnectionRepository();
  const cipher = new AesGcmSecretCipher({ current: "v1", keys: { v1: randomBytes(32) } });
  const linkers = new LinkersByMethod({ qr, cloud_api: new UnconfiguredWhatsAppLinker() });
  return {
    repository,
    list: new ListConnectionsService(repository),
    create: new CreateConnectionService(repository),
    rename: new RenameConnectionService(repository),
    remove: new DeleteConnectionService(repository, linkers, cipher),
    link: new LinkConnectionService(repository, linkers, cipher),
    check: new CheckConnectionService(repository, linkers, cipher),
    events: new HandleProviderEventService(repository, cipher)
  };
}

const qrOutcome: StartOutcome = { kind: "qr", qrImage: "data:image/png;base64,AA", session: { ref: "inst-1", secret: TOKEN } };

describe("dominio", () => {
  it("normaliza nombres y teléfonos", () => {
    expect(normalizeConnectionName("  Ventas   Colombia ")).toBe("Ventas Colombia");
    expect(normalizeConnectionName("")).toBeNull();
    expect(normalizeConnectionName("x".repeat(41))).toBeNull();
    expect(normalizePhoneNumber("+57 301 381 5302")).toBe("573013815302");
    expect(normalizePhoneNumber("123")).toBeNull();
  });
});

describe("crear y renombrar", () => {
  it("crea una conexión pendiente por cuenta, con nombres únicos sin importar mayúsculas", async () => {
    const s = setup();
    const created = await s.create.execute(T, { name: "Ventas", method: "qr" });
    expect(created).toMatchObject({ name: "Ventas", method: "qr", status: "pending", phoneNumber: null });
    await expect(s.create.execute(T, { name: "ventas", method: "cloud_api" })).rejects.toThrow(ConflictError);
    await s.create.execute(OTHER, { name: "Ventas", method: "qr" });
    expect(await s.list.execute(T)).toHaveLength(1);
  });

  it("valida el método y el nombre; renombra solo en su cuenta", async () => {
    const s = setup();
    await expect(s.create.execute(T, { name: "A", method: "sms" as never })).rejects.toThrow(ValidationError);
    await expect(s.create.execute(T, { name: " ", method: "qr" })).rejects.toThrow(ValidationError);
    const created = await s.create.execute(T, { name: "Ventas", method: "qr" });
    expect((await s.rename.execute(T, created.id, { name: "Soporte" })).name).toBe("Soporte");
    await expect(s.rename.execute(OTHER, created.id, { name: "X" })).rejects.toThrow(NotFoundError);
  });
});

describe("vincular por QR", () => {
  it("sin proveedor lo dice y no cambia nada", async () => {
    const s = setup();
    const created = await s.create.execute(T, { name: "Ventas", method: "qr" });
    const state = await s.link.execute(T, created.id);
    expect(state.state === "unavailable" && state.message).toMatch(/código QR/);
    expect((await s.list.execute(T))[0]!.status).toBe("pending");
  });

  it("guarda el token de la sesión CIFRADO y nunca lo devuelve", async () => {
    const s = setup(fakeLinker(qrOutcome));
    const created = await s.create.execute(T, { name: "Ventas", method: "qr" });
    const state = await s.link.execute(T, created.id);
    expect(state).toMatchObject({ state: "qr", qrImage: "data:image/png;base64,AA", connection: { status: "connecting" } });
    expect(JSON.stringify(state)).not.toContain(TOKEN);

    const stored = (await s.repository.findById(T, created.id))!;
    expect(stored.providerRef).toBe("inst-1");
    expect(stored.providerSecret).not.toContain(TOKEN);
    expect(stored.providerSecret).toMatch(/^v1\./);
  });

  it("reconectar reutiliza la sesión guardada (descifrada) en el proveedor", async () => {
    const linker = fakeLinker(qrOutcome);
    const s = setup(linker);
    const created = await s.create.execute(T, { name: "Ventas", method: "qr" });
    await s.link.execute(T, created.id);
    await s.link.execute(T, created.id);
    expect(linker.start.mock.calls[0]![1]).toBeNull();
    expect(linker.start.mock.calls[1]![1]).toEqual({ ref: "inst-1", secret: TOKEN });
  });

  it("«Generar otro código» descarta el actual y trae uno nuevo con la misma sesión", async () => {
    const linker = fakeLinker(qrOutcome);
    const s = setup(linker);
    const created = await s.create.execute(T, { name: "Ventas", method: "qr" });
    await s.link.execute(T, created.id);
    const fresh = await s.link.execute(T, created.id, { restart: true });
    expect(fresh).toMatchObject({ state: "qr", qrImage: "data:image/png;base64,NUEVO", connection: { status: "connecting" } });
    expect(linker.restart).toHaveBeenCalledWith({ ref: "inst-1", secret: TOKEN });
    expect(linker.start).toHaveBeenCalledTimes(1);
  });

  it("al consultar: QR renovado → conectada con número y perfil", async () => {
    const s = setup(fakeLinker(qrOutcome, [{ kind: "qr", qrImage: "data:image/png;base64,BB" }, { kind: "connected", phoneNumber: "573013815302", profileName: "Auream", profilePictureUrl: null }]));
    const created = await s.create.execute(T, { name: "Ventas", method: "qr" });
    await s.link.execute(T, created.id);
    expect(await s.check.execute(T, created.id)).toMatchObject({ state: "qr", qrImage: "data:image/png;base64,BB" });
    const done = await s.check.execute(T, created.id);
    expect(done).toMatchObject({ state: "connected", connection: { status: "connected", phoneNumber: "573013815302", profileName: "Auream" } });
    expect(done.connection.lastConnectedAt).not.toBeNull();
  });

  it("si el QR vence sin escanear, vuelve a «sin vincular»; si se cae una conectada, queda «desconectada»", async () => {
    const s = setup(fakeLinker(qrOutcome, [{ kind: "disconnected" }, { kind: "connected", phoneNumber: "573013815302", profileName: null, profilePictureUrl: null }, { kind: "disconnected" }]));
    const created = await s.create.execute(T, { name: "Ventas", method: "qr" });
    await s.link.execute(T, created.id);
    expect((await s.check.execute(T, created.id)).connection.status).toBe("pending");
    await s.check.execute(T, created.id);
    expect((await s.check.execute(T, created.id)).connection.status).toBe("disconnected");
  });

  it("si el proveedor falla, el error lo dice sin tocar la conexión", async () => {
    const linker = fakeLinker(qrOutcome);
    linker.start.mockRejectedValueOnce(new LinkerError("uazapi no respondió a tiempo."));
    const s = setup(linker);
    const created = await s.create.execute(T, { name: "Ventas", method: "qr" });
    await expect(s.link.execute(T, created.id)).rejects.toThrow(UpstreamError);
    expect((await s.list.execute(T))[0]!.status).toBe("pending");
  });
});

describe("ver estado de un número conectado", () => {
  it("pone al día los avisos del proveedor con la sesión guardada", async () => {
    const online = { kind: "connected", phoneNumber: "573013815302", profileName: null, profilePictureUrl: null } as const;
    const linker = fakeLinker(qrOutcome, [online, online, { kind: "disconnected" }]);
    const s = setup(linker);
    const created = await s.create.execute(T, { name: "Ventas", method: "qr" });
    await s.link.execute(T, created.id);
    await s.check.execute(T, created.id);
    expect((await s.link.execute(T, created.id)).state).toBe("connected");
    // Si al ver el estado el proveedor dice que se cerró la sesión, sigue a vincular: sale el QR.
    const after = await s.link.execute(T, created.id);
    expect([after.state, after.connection.status]).toEqual(["qr", "connecting"]);
    expect(linker.refresh).toHaveBeenCalledWith({ ref: "inst-1", secret: TOKEN });
  });
});

describe("eliminar", () => {
  it("borra la sesión en el proveedor y después la conexión", async () => {
    const linker = fakeLinker(qrOutcome);
    const s = setup(linker);
    const created = await s.create.execute(T, { name: "Ventas", method: "qr" });
    await s.link.execute(T, created.id);
    await s.remove.execute(T, created.id);
    expect(linker.unlink).toHaveBeenCalledWith({ ref: "inst-1", secret: TOKEN });
    expect(await s.list.execute(T)).toEqual([]);
  });

  it("si el proveedor falla al borrar, no borra nada (no deja sesiones huérfanas)", async () => {
    const linker = fakeLinker(qrOutcome);
    linker.unlink.mockRejectedValueOnce(new LinkerError("uazapi respondió 500."));
    const s = setup(linker);
    const created = await s.create.execute(T, { name: "Ventas", method: "qr" });
    await s.link.execute(T, created.id);
    await expect(s.remove.execute(T, created.id)).rejects.toThrow(UpstreamError);
    expect(await s.list.execute(T)).toHaveLength(1);
  });
});

describe("avisos del proveedor", () => {
  async function linked() {
    const s = setup(fakeLinker(qrOutcome, [{ kind: "connected", phoneNumber: "573013815302", profileName: "Auream", profilePictureUrl: null }]));
    const created = await s.create.execute(T, { name: "Ventas", method: "qr" });
    await s.link.execute(T, created.id);
    await s.check.execute(T, created.id);
    return { s, id: created.id };
  }

  it("con el token correcto, «desconectada» se aplica", async () => {
    const { s, id } = await linked();
    expect(await s.events.execute({ connectionId: id, secret: TOKEN, status: "disconnected" })).toBe(true);
    expect((await s.list.execute(T))[0]!.status).toBe("disconnected");
  });

  it("con otro token, o para una conexión que no existe, se ignora", async () => {
    const { s, id } = await linked();
    expect(await s.events.execute({ connectionId: id, secret: "falso", status: "disconnected" })).toBe(false);
    expect(await s.events.execute({ connectionId: "33333333-3333-4333-8333-333333333333", secret: TOKEN, status: "disconnected" })).toBe(false);
    expect((await s.list.execute(T))[0]!.status).toBe("connected");
  });
});

describe("composición", () => {
  it("sin uazapi configurado, el QR responde que falta el proveedor", async () => {
    const services = composeConnectionsServicesWith(new InMemoryConnectionRepository(), { keyRing: null, uazapi: null, webhookBaseUrl: null });
    const created = await services.create.execute(T, { name: "Ventas", method: "qr" });
    expect((await services.link.execute(T, created.id)).state).toBe("unavailable");
  });
});
