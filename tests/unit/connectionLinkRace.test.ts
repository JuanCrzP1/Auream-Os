import { describe, expect, it, vi } from "vitest";
import { randomBytes } from "node:crypto";
import { CreateConnectionService, LinkConnectionService } from "../../domains/connections/application/ConnectionServices.js";
import type { LinkTarget, ProviderSession, SessionState, WhatsAppLinker } from "../../domains/connections/application/ports/WhatsAppLinker.js";
import { InMemoryConnectionRepository } from "../../infrastructure/persistence/memory/InMemoryConnectionRepository.js";
import { LinkersByMethod } from "../../infrastructure/whatsapp/LinkersByMethod.js";
import { UnconfiguredWhatsAppLinker } from "../../infrastructure/whatsapp/UnconfiguredWhatsAppLinker.js";
import { AesGcmSecretCipher } from "../../platform/security/secrets/AesGcmSecretCipher.js";

// ---------------------------------------------------------------------------
// Dos pedidos de QR a la vez (dos pestañas, doble clic) no dejan dos sesiones
// en el proveedor. Lo encontró el WhatsApp simulado: uazapi creaba dos
// instancias con 4 ms de diferencia y una quedaba huérfana.
// ---------------------------------------------------------------------------

const T = "11111111-1111-4111-8111-111111111111";

function setup() {
  let created = 0;
  const live = new Set<string>();
  const linker = {
    // Como uazapi: sin sesión crea una instancia nueva (tarda un poco); con sesión devuelve su mismo QR.
    start: vi.fn(async (_target: LinkTarget, session: ProviderSession | null) => {
      if (session) return { kind: "qr" as const, qrImage: `QR-${session.ref}`, session };
      await new Promise((resolve) => setTimeout(resolve, 5));
      const fresh = { ref: `inst-${(created += 1)}`, secret: `tok-${created}` };
      live.add(fresh.ref);
      return { kind: "qr" as const, qrImage: `QR-${fresh.ref}`, session: fresh };
    }),
    restart: vi.fn(async (): Promise<SessionState> => ({ kind: "qr", qrImage: "QR" })),
    refresh: vi.fn(async () => undefined),
    check: vi.fn(async (): Promise<SessionState> => ({ kind: "qr", qrImage: "QR" })),
    disconnect: vi.fn(async () => undefined),
    reset: vi.fn(async () => undefined),
    unlink: vi.fn(async (session: ProviderSession) => void live.delete(session.ref))
  } satisfies WhatsAppLinker;
  const repository = new InMemoryConnectionRepository();
  const cipher = new AesGcmSecretCipher({ current: "v1", keys: { v1: randomBytes(32) } });
  const linkers = new LinkersByMethod({ qr: linker, cloud_api: new UnconfiguredWhatsAppLinker() });
  return { live, repository, create: new CreateConnectionService(repository), link: new LinkConnectionService(repository, linkers, cipher) };
}

describe("vincular un número dos veces a la vez", () => {
  it("queda UNA sesión: la que perdió se borra y los dos pedidos muestran el mismo QR", async () => {
    const s = setup();
    const { id } = await s.create.execute(T, { name: "Ventas", method: "qr" });
    const [first, second] = await Promise.all([s.link.execute(T, id), s.link.execute(T, id)]);

    const saved = await s.repository.findById(T, id);
    expect([...s.live]).toEqual([saved?.providerRef]);
    expect(first).toMatchObject({ state: "qr" });
    expect(second).toMatchObject({ state: "qr" });
    expect([first, second].map((state) => (state.state === "qr" ? state.qrImage : null))).toEqual([`QR-${saved?.providerRef}`, `QR-${saved?.providerRef}`]);
  });

  it("un pedido solo sigue igual: crea la sesión y la guarda", async () => {
    const s = setup();
    const { id } = await s.create.execute(T, { name: "Ventas", method: "qr" });
    expect(await s.link.execute(T, id)).toMatchObject({ state: "qr", qrImage: "QR-inst-1" });
    expect((await s.repository.findById(T, id))?.providerRef).toBe("inst-1");
  });
});
