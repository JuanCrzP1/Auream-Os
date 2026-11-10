import { describe, expect, it, vi } from "vitest";
import { AdConnectionServices } from "../../domains/ads/application/AdConnectionServices.js";
import { AdsProviderError, type AdsProvider, type AdsRepository } from "../../domains/ads/application/AdsPorts.js";
import { AdsSyncService } from "../../domains/ads/application/AdsSyncService.js";
import type { AdAccount, MetaConnection, ProviderAdAccount } from "../../domains/ads/domain/AdAccount.js";

// ---------------------------------------------------------------------------
// Conectar Meta Ads y sincronizar: el token se guarda cifrado, con una sola
// cuenta activa no hay nada que elegir, la primera vuelta trae dos tramos y
// las siguientes cada 3 horas; un token vencido pide reconectar y no insiste.
// ---------------------------------------------------------------------------

const T = "tenant-a";
const NOW = new Date("2026-11-10T15:00:00.000Z");
const ACT = (externalId: string, providerStatus = 1): ProviderAdAccount => ({ externalId, name: externalId, currency: "COP", timezone: "America/Bogota", providerStatus });

function world(accounts: ProviderAdAccount[] = [ACT("act_1")]) {
  let connection: MetaConnection | null = null;
  const stored: AdAccount[] = [];
  const repository = {
    connection: async () => connection,
    saveConnection: async (c: MetaConnection) => void (connection = c),
    setConnectionError: vi.fn(async (_t: string, error: string | null) => void (connection = connection && { ...connection, lastError: error })),
    removeConnection: async () => void ((connection = null), stored.splice(0)),
    accounts: async () => stored,
    account: async (_t: string, id: string) => stored.find((a) => a.id === id) ?? null,
    upsertAccounts: async (_t: string, list: ReadonlyArray<ProviderAdAccount>) => {
      for (const a of list) if (!stored.some((s) => s.externalId === a.externalId)) stored.push({ ...a, id: `00000000-0000-4000-8000-00000000000${stored.length + 1}`, tenantId: T, enabled: false, lastSyncedAt: null, lastError: null });
    },
    setEnabled: async (_t: string, id: string, enabled: boolean) => {
      const i = stored.findIndex((a) => a.id === id);
      if (i < 0) return null;
      stored[i] = { ...stored[i]!, enabled };
      return stored[i]!;
    },
    markSynced: vi.fn(async (_t: string, id: string, error: string | null) => {
      const i = stored.findIndex((a) => a.id === id);
      stored[i] = { ...stored[i]!, lastError: error, ...(error === null ? { lastSyncedAt: NOW.toISOString() } : {}) };
    }),
    saveEntities: vi.fn(async () => {}),
    saveInsights: vi.fn(async () => {})
  } satisfies AdsRepository;
  const provider = {
    authorizeUrl: () => null,
    exchangeCode: vi.fn(),
    me: vi.fn(async () => ({ id: "m1", name: "Camilo Meta" })),
    tokenExpiry: async () => null,
    listAccounts: vi.fn(async () => accounts),
    entities: vi.fn(async () => []),
    insights: vi.fn(async () => [])
  } satisfies AdsProvider;
  const cipher = { encrypt: (text: string, ctx: string) => `enc(${ctx}):${text.length}`, decrypt: () => "EAAB-token-descifrado" };
  const scheduler = { scheduleSync: vi.fn(async () => {}) };
  const actor = { tenantId: T, userId: "u1", canManage: true };
  const connectionServices = new AdConnectionServices(repository, provider, cipher, scheduler, null, "https://x/cb", () => NOW);
  const sync = new AdsSyncService(repository, provider, cipher, scheduler, vi.fn(), () => NOW);
  return { repository, provider, scheduler, actor, connectionServices, sync, stored, getConnection: () => connection };
}

describe("AdConnectionServices", () => {
  it("con un token: guarda cifrado, trae las cuentas y con una sola activa la usa y sincroniza", async () => {
    const w = world([ACT("act_1"), ACT("act_2", 2)]);
    const status = await w.connectionServices.connectWithToken(w.actor, `  EAAB${"x".repeat(30)}  `);
    expect(w.getConnection()).toMatchObject({ method: "token", metaUserName: "Camilo Meta", tokenCiphertext: "enc(tenant-a:meta):34" });
    expect(status.accounts.map((a) => [a.externalId, a.active, a.enabled])).toEqual([["act_1", true, true], ["act_2", false, false]]);
    expect(w.scheduler.scheduleSync).toHaveBeenCalledWith(T, w.stored[0]!.id, NOW);
    expect(status).toMatchObject({ connection: { connected: true, needsReconnect: false }, oauthAvailable: false });
  });

  it("rechaza un token incompleto, uno sin cuentas y explica el error de Meta", async () => {
    await expect(world().connectionServices.connectWithToken(world().actor, "corto")).rejects.toThrow("Pega el token completo de Meta.");
    await expect(world([]).connectionServices.connectWithToken(world().actor, "EAAB" + "x".repeat(30))).rejects.toThrow("no tiene cuentas publicitarias");
    const w = world();
    w.provider.me.mockRejectedValueOnce(new AdsProviderError("Meta rechazó el permiso (venció o lo quitaron). Vuelve a conectar Meta Ads.", true));
    await expect(w.connectionServices.connectWithToken(w.actor, "EAAB" + "x".repeat(30))).rejects.toThrow("Vuelve a conectar");
  });

  it("sin app de Meta no hay inicio de sesión; sincronizar a mano pide esperar 5 minutos entre una y otra", async () => {
    const w = world();
    expect(() => w.connectionServices.startOAuth(w.actor)).toThrow("Conecta con un token por ahora.");
    await w.connectionServices.connectWithToken(w.actor, "EAAB" + "x".repeat(30));
    await w.sync.sync(T, w.stored[0]!.id);
    await expect(w.connectionServices.syncNow(w.actor, w.stored[0]!.id)).rejects.toThrow("hace menos de 5 minutos");
  });
});

describe("AdsSyncService", () => {
  it("la primera vez trae 31 días, deja los 31 anteriores para otra vuelta y programa la siguiente en 3 horas", async () => {
    const w = world();
    await w.connectionServices.connectWithToken(w.actor, "EAAB" + "x".repeat(30));
    w.scheduler.scheduleSync.mockClear();
    await w.sync.sync(T, w.stored[0]!.id);
    expect(w.provider.insights).toHaveBeenCalledWith("EAAB-token-descifrado", "act_1", "2026-10-11", "2026-11-10");
    expect(w.scheduler.scheduleSync).toHaveBeenCalledWith(T, w.stored[0]!.id, NOW, { since: "2026-09-10", until: "2026-10-10" });
    expect(w.scheduler.scheduleSync).toHaveBeenCalledWith(T, w.stored[0]!.id, new Date(NOW.getTime() + 3 * 3_600_000));
    w.provider.insights.mockClear();
    await w.sync.sync(T, w.stored[0]!.id);
    expect(w.provider.insights).toHaveBeenCalledWith(expect.anything(), "act_1", "2026-11-04", "2026-11-10");
  });

  it("un token vencido queda anotado, pide reconectar y no reprograma; otra falla sí reintenta", async () => {
    const w = world();
    await w.connectionServices.connectWithToken(w.actor, "EAAB" + "x".repeat(30));
    w.scheduler.scheduleSync.mockClear();
    w.provider.entities.mockRejectedValueOnce(new AdsProviderError("Meta rechazó el permiso.", true));
    await w.sync.sync(T, w.stored[0]!.id);
    expect(w.getConnection()!.lastError).toBe("Meta rechazó el permiso.");
    expect(w.scheduler.scheduleSync).not.toHaveBeenCalled();
    w.provider.entities.mockRejectedValueOnce(new Error("red"));
    await w.sync.sync(T, w.stored[0]!.id);
    expect(w.stored[0]!.lastError).toContain("Se reintenta");
    expect(w.scheduler.scheduleSync).toHaveBeenCalledTimes(1);
  });

  it("una cuenta que no está elegida no se sincroniza", async () => {
    const w = world([ACT("act_1"), ACT("act_2")]);
    await w.connectionServices.connectWithToken(w.actor, "EAAB" + "x".repeat(30));
    await w.sync.sync(T, w.stored[1]!.id);
    expect(w.provider.entities).not.toHaveBeenCalled();
  });
});
