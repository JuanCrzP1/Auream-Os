import { describe, expect, it, vi } from "vitest";
import { randomBytes } from "node:crypto";
import { CheckConnectionService, CreateConnectionService, LinkConnectionService } from "../../domains/connections/application/ConnectionServices.js";
import { DisconnectConnectionService, RestartConnectionService } from "../../domains/connections/application/ConnectionSessionServices.js";
import type { SessionState, WhatsAppLinker } from "../../domains/connections/application/ports/WhatsAppLinker.js";
import { InMemoryConnectionRepository } from "../../infrastructure/persistence/memory/InMemoryConnectionRepository.js";
import { LinkersByMethod } from "../../infrastructure/whatsapp/LinkersByMethod.js";
import { UnconfiguredWhatsAppLinker } from "../../infrastructure/whatsapp/UnconfiguredWhatsAppLinker.js";
import { AesGcmSecretCipher } from "../../platform/security/secrets/AesGcmSecretCipher.js";

// ---------------------------------------------------------------------------
// Desconectar, reconectar y reiniciar un número, como en Leona. Desconectar
// cierra la sesión de WhatsApp pero conserva la conexión (y su sesión en el
// proveedor): «Reconectar» pide un QR nuevo sobre ella. La foto de perfil del
// número llega con su estado y se conserva si el proveedor no la manda.
// ---------------------------------------------------------------------------

const T = "11111111-1111-4111-8111-111111111111";
const FOTO = "https://pps.whatsapp.net/v/numero.jpg";

function setup() {
  const states: SessionState[] = [{ kind: "connected", phoneNumber: "573013815302", profileName: "Ventas", profilePictureUrl: FOTO }];
  const linker = {
    start: vi.fn(async () => ({ kind: "qr" as const, qrImage: "data:image/png;base64,QR", session: { ref: "inst-1", secret: "tok" } })),
    restart: vi.fn(async (): Promise<SessionState> => ({ kind: "qr", qrImage: "data:image/png;base64,QR2" })),
    refresh: vi.fn(async () => undefined),
    check: vi.fn(async (): Promise<SessionState> => states.shift() ?? { kind: "connected", phoneNumber: "573013815302", profileName: "Ventas", profilePictureUrl: null }),
    disconnect: vi.fn(async () => undefined),
    reset: vi.fn(async () => undefined),
    unlink: vi.fn(async () => undefined)
  } satisfies WhatsAppLinker;
  const repository = new InMemoryConnectionRepository();
  const cipher = new AesGcmSecretCipher({ current: "v1", keys: { v1: randomBytes(32) } });
  const linkers = new LinkersByMethod({ qr: linker, cloud_api: new UnconfiguredWhatsAppLinker() });
  const deps = { repository, linkers, cipher };
  return {
    linker,
    create: new CreateConnectionService(repository),
    link: new LinkConnectionService(repository, linkers, cipher),
    check: new CheckConnectionService(repository, linkers, cipher),
    disconnect: new DisconnectConnectionService(deps),
    restart: new RestartConnectionService(deps)
  };
}

async function connected(s: ReturnType<typeof setup>) {
  const { id } = await s.create.execute(T, { name: "Ventas", method: "qr" });
  await s.link.execute(T, id);
  const state = await s.check.execute(T, id);
  return { id, state };
}

describe("sesión de un número", () => {
  it("al conectar guarda la foto de perfil del número; si luego no viene, se conserva", async () => {
    const s = setup();
    const { id, state } = await connected(s);
    expect([state.connection.status, state.connection.profilePictureUrl]).toEqual(["connected", FOTO]);
    expect((await s.check.execute(T, id)).connection.profilePictureUrl).toBe(FOTO);
  });

  it("desconectar cierra la sesión de WhatsApp sin borrar la conexión; reconectar pide un QR sobre la misma sesión", async () => {
    const s = setup();
    const { id } = await connected(s);
    const after = await s.disconnect.execute(T, id);
    expect([after.status, after.phoneNumber]).toEqual(["disconnected", "573013815302"]);
    expect(s.linker.disconnect).toHaveBeenCalledWith({ ref: "inst-1", secret: "tok" });
    expect(s.linker.unlink).not.toHaveBeenCalled();

    const again = await s.link.execute(T, id);
    expect(again.state).toBe("qr");
    expect(s.linker.start).toHaveBeenLastCalledWith(expect.objectContaining({ id }), { ref: "inst-1", secret: "tok" });
    await expect(s.disconnect.execute(T, (await s.create.execute(T, { name: "Nuevo", method: "qr" })).id)).rejects.toThrow(/no está vinculada/);
  });

  it("reiniciar retoma la conexión sin desvincular; solo para números conectados", async () => {
    const s = setup();
    const { id } = await connected(s);
    expect((await s.restart.execute(T, id)).status).toBe("connected");
    expect(s.linker.reset).toHaveBeenCalledTimes(1);
    await s.disconnect.execute(T, id);
    await expect(s.restart.execute(T, id)).rejects.toThrow(/Reconectar/);
  });
});
