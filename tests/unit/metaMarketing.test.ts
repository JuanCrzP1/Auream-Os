import { describe, expect, it, vi } from "vitest";
import { MetaMarketingClient } from "../../infrastructure/meta/MetaMarketingClient.js";
import { parseBudget, parseInsight } from "../../infrastructure/meta/metaInsights.js";
import { AdsProviderError } from "../../domains/ads/application/AdsPorts.js";
import { OAuthStateSigner } from "../../domains/ads/application/OAuthState.js";
import { adviceFor } from "../../domains/analytics/domain/adAdvice.js";

// ---------------------------------------------------------------------------
// Meta Ads por dentro: cómo se leen sus métricas (sin sumar dos veces la misma
// compra), el cliente (token en la cabecera, páginas, errores en español), el
// `state` firmado del inicio de sesión y el consejo por campaña.
// ---------------------------------------------------------------------------

const json = (status: number, body: unknown) => ({ ok: status < 400, status, json: async () => body }) as unknown as Response;
const TOKEN = "EAAB" + "x".repeat(40);

describe("lectura de Meta", () => {
  it("una fila de métricas: conversaciones de WhatsApp y la compra más grande (Meta la repite con varios nombres)", () => {
    expect(parseInsight({
      ad_id: "9", date_start: "2026-11-01", spend: "1234.5", impressions: "1000", clicks: "30",
      actions: [{ action_type: "onsite_conversion.messaging_conversation_started_7d", value: "12" }, { action_type: "purchase", value: "3" }, { action_type: "omni_purchase", value: "3" }],
      action_values: [{ action_type: "purchase", value: "149700" }, { action_type: "omni_purchase", value: "149700" }]
    })).toEqual({ adId: "9", day: "2026-11-01", spend: 1234.5, impressions: 1000, clicks: 30, conversations: 12, metaPurchases: 3, metaRevenue: 149700 });
    expect(parseInsight({ spend: "1" })).toBeNull();
  });

  it("el presupuesto viene en centavos, salvo en monedas sin decimales como el peso colombiano", () => {
    expect(parseBudget("1500000", "COP")).toBe(1500000);
    expect(parseBudget("2500", "USD")).toBe(25);
    expect(parseBudget("0", "USD")).toBeNull();
  });
});

describe("MetaMarketingClient", () => {
  it("el token va en la cabecera (nunca en la URL) con appsecret_proof, y sigue las páginas", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json(200, { data: [{ id: "act_1", name: "Ventas", currency: "cop", timezone_name: "America/Bogota", account_status: 1 }], paging: { next: "x", cursors: { after: "c1" } } }))
      .mockResolvedValueOnce(json(200, { data: [{ id: "act_2", name: "USD", currency: "USD", account_status: 2 }], paging: {} }));
    const client = new MetaMarketingClient({ appId: "123", appSecret: "secreto-de-la-app-123" }, "v23.0", fetchMock);
    const accounts = await client.listAccounts(TOKEN);
    expect(accounts).toEqual([
      { externalId: "act_1", name: "Ventas", currency: "COP", timezone: "America/Bogota", providerStatus: 1 },
      { externalId: "act_2", name: "USD", currency: "USD", timezone: "UTC", providerStatus: 2 }
    ]);
    const [url, init] = fetchMock.mock.calls[1]!;
    expect(url).not.toContain(TOKEN);
    expect(url).toContain("after=c1");
    expect(url).toContain("appsecret_proof=");
    expect((init as RequestInit).headers).toEqual({ Authorization: `Bearer ${TOKEN}` });
  });

  it("errores de Meta en español; un token vencido pide reconectar y nunca aparece en el mensaje", async () => {
    const client = (body: unknown, status = 400) => new MetaMarketingClient(null, "v23.0", vi.fn().mockResolvedValue(json(status, body)));
    await expect(client({ error: { code: 190, message: "Error validating access token" } }).me(TOKEN)).rejects.toMatchObject({ reconnect: true, message: expect.stringContaining("Vuelve a conectar") });
    await expect(client({ error: { code: 17 } }).me(TOKEN)).rejects.toMatchObject({ reconnect: false, message: expect.stringContaining("limitando") });
    const leaky = client({ error: { code: 1, message: `boom ${TOKEN}` } }, 500).me(TOKEN);
    await expect(leaky).rejects.toBeInstanceOf(AdsProviderError);
    await expect(leaky).rejects.not.toThrow(TOKEN);
  });

  it("sin app configurada no ofrece el inicio de sesión; con app arma el enlace con los permisos de anuncios", () => {
    expect(new MetaMarketingClient(null).authorizeUrl("s", "https://x/cb")).toBeNull();
    const url = new URL(new MetaMarketingClient({ appId: "123", appSecret: "s".repeat(20) }).authorizeUrl("estado", "https://x/cb")!);
    expect(url.pathname).toBe("/v23.0/dialog/oauth");
    expect(Object.fromEntries(url.searchParams)).toMatchObject({ client_id: "123", redirect_uri: "https://x/cb", state: "estado", scope: "ads_read,business_management" });
  });
});

describe("OAuthStateSigner", () => {
  it("firma la cuenta y la persona; alterado, de otra clave o vencido no vale", () => {
    let now = 1_000_000;
    const signer = new OAuthStateSigner("clave-del-servidor-1234", () => now);
    const state = signer.sign({ tenantId: "t1", userId: "u1" });
    expect(signer.verify(state)).toEqual({ tenantId: "t1", userId: "u1" });
    expect(signer.verify(state.replace(/.$/, (c) => (c === "A" ? "B" : "A")))).toBeNull();
    expect(new OAuthStateSigner("otra-clave-del-servidor-9").verify(state)).toBeNull();
    now += 11 * 60_000;
    expect(signer.verify(state)).toBeNull();
    expect(() => new OAuthStateSigner("corta")).toThrow();
  });
});

describe("qué hacer con cada campaña", () => {
  const base = { spend: 100000, sales: 5, chats: 40, roas: 4, accountCostPerSale: 10000 };
  it("escalar, mantener, revisar, apagar o esperar", () => {
    expect(adviceFor(base).advice).toBe("scale");
    expect(adviceFor({ ...base, roas: 2 }).advice).toBe("keep");
    expect(adviceFor({ ...base, roas: 1.2 })).toEqual({ advice: "review", reason: "Apenas cubre su gasto." });
    expect(adviceFor({ ...base, roas: 0.5 }).reason).toBe("Gasta más de lo que vende.");
    expect(adviceFor({ ...base, sales: 0, roas: 0, spend: 40000, chats: 18 })).toEqual({ advice: "pause", reason: "18 chats y ninguna venta." });
    expect(adviceFor({ ...base, sales: 0, roas: 0, spend: 4000, chats: 2 }).advice).toBe("learning");
  });
});
