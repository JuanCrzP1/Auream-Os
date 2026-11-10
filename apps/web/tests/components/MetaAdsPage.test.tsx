import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { MetaAdsPage } from "../../src/features/ads/pages/MetaAdsPage";
import { IntegrationsPage } from "../../src/features/integrations/pages/IntegrationsPage";
import { IntegrationDetailPage } from "../../src/features/integrations/pages/IntegrationDetailPage";

// ---------------------------------------------------------------------------
// Meta Ads: todo lo de Meta en un lugar, como en Leona (Campañas · Píxel ·
// Cuentas). El Píxel se mudó de Integraciones con su logo; la tarjeta de
// Integraciones y la dirección vieja llevan hasta aquí.
// ---------------------------------------------------------------------------

const reply = (status: number, body?: unknown) =>
  ({ ok: status < 400, status, json: async () => body, text: async () => JSON.stringify(body ?? {}) }) as unknown as Response;

const PIXEL = { id: "p1", name: "Píxel tienda", pixelId: "123456789012345", tokenHint: "••••ZDZD", status: "active", lastVerifiedAt: null, createdAt: "x" };

function stubApi(pixels: ReadonlyArray<typeof PIXEL> = [PIXEL]) {
  vi.stubGlobal("fetch", vi.fn(async (input: string) => {
    const url = new URL(String(input), "http://api.test");
    if (url.pathname === "/pixel-connections") return reply(200, { connections: pixels });
    if (url.pathname === "/ai-credentials") return reply(200, { credentials: [] });
    if (url.pathname === "/inbound-webhooks") return reply(200, { webhooks: [] });
    if (url.pathname === "/mcp-credentials") return reply(200, { server: { url: "https://x/api/mcp" }, credentials: [] });
    return reply(404, { message: "no" });
  }));
}

function Where() {
  const location = useLocation();
  return <span data-testid="where">{location.pathname + location.search}</span>;
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/meta-ads" element={<MetaAdsPage />} />
        <Route path="/integrations" element={<IntegrationsPage />} />
        <Route path="/integrations/:integrationId" element={<IntegrationDetailPage />} />
      </Routes>
      <Where />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
  stubApi();
});

describe("Meta Ads", () => {
  it("abre en el Píxel con el logo de Meta y sus píxeles conectados", async () => {
    renderAt("/meta-ads");
    expect(screen.getByRole("heading", { level: 1, name: "Meta Ads" })).toBeInTheDocument();
    expect(document.querySelector(".ui-page__header .provider-mark--meta")).not.toBeNull();
    expect(screen.getByRole("tab", { name: "Píxel" })).toHaveAttribute("aria-selected", "true");
    expect(await screen.findByText("Píxel tienda")).toBeInTheDocument();
    expect(screen.getByText("Píxel 123456789012345")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Conectar píxel" })).toBeInTheDocument();
  });

  it("las pestañas Campañas y Cuentas cuentan lo que traerán, y la pestaña viaja en la dirección", async () => {
    renderAt("/meta-ads");
    await userEvent.click(screen.getByRole("tab", { name: "Campañas" }));
    expect(screen.getByText("Tus campañas, con su gasto y sus ventas")).toBeInTheDocument();
    expect(screen.getByTestId("where")).toHaveTextContent("/meta-ads?tab=campaigns");

    await userEvent.click(screen.getByRole("tab", { name: "Cuentas" }));
    expect(screen.getByText("Conectar con Meta")).toBeInTheDocument();
    expect(screen.getByTestId("where")).toHaveTextContent("/meta-ads?tab=accounts");
  });

  it("en Integraciones, la tarjeta de Meta lleva al Píxel en Meta Ads, y la dirección vieja también", async () => {
    renderAt("/integrations");
    const card = (await screen.findByRole("heading", { level: 3, name: "Meta Ads" })).closest("article")!;
    await userEvent.click(within(card).getByRole("link"));
    expect(screen.getByTestId("where")).toHaveTextContent("/meta-ads?tab=pixel");
  });

  it("/integrations/meta-pixel redirige al Píxel en Meta Ads", async () => {
    renderAt("/integrations/meta-pixel");
    expect(await screen.findByRole("heading", { level: 1, name: "Meta Ads" })).toBeInTheDocument();
    expect(screen.getByTestId("where")).toHaveTextContent("/meta-ads?tab=pixel");
  });
});
