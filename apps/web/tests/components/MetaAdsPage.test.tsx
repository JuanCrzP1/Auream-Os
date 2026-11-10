import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { MetaAdsPage } from "../../src/features/ads/pages/MetaAdsPage";
import { IntegrationsPage } from "../../src/features/integrations/pages/IntegrationsPage";
import { IntegrationDetailPage } from "../../src/features/integrations/pages/IntegrationDetailPage";

// ---------------------------------------------------------------------------
// Meta Ads, con diseño propio de Auream: las secciones (Píxel · Rendimiento ·
// Cuentas) son tarjetas con su estado en vivo y se recorren como pestañas; el
// Píxel sin conectar muestra su portada con el recorrido de la conversión. La
// tarjeta de Integraciones y la dirección vieja llevan hasta el Píxel.
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
  it("abre en el Píxel con el logo de Meta, sus píxeles y su estado en la tarjeta", async () => {
    renderAt("/meta-ads");
    expect(screen.getByRole("heading", { level: 1, name: "Meta Ads" })).toBeInTheDocument();
    expect(document.querySelector(".ui-page__header .provider-mark--meta")).not.toBeNull();
    const pixelTab = screen.getByRole("tab", { name: "Píxel" });
    expect(pixelTab).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel", { name: "Píxel" })).toBeInTheDocument();

    expect(await screen.findByText("Píxel tienda")).toBeInTheDocument();
    expect(screen.getByText("Píxel 123456789012345")).toBeInTheDocument();
    expect(pixelTab).toHaveAccessibleDescription("1 activo");
    expect(screen.getByRole("button", { name: "Conectar otro píxel" })).toBeInTheDocument();
  });

  it("si Meta rechazó un token, la tarjeta Píxel lo avisa", async () => {
    stubApi([{ ...PIXEL, status: "invalid" }]);
    renderAt("/meta-ads");
    expect(await screen.findByText("Píxel tienda")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Píxel" })).toHaveAccessibleDescription("1 token rechazado");
  });

  it("sin píxeles muestra la portada con el recorrido de la conversión, y su botón abre el diálogo de conectar", async () => {
    stubApi([]);
    renderAt("/meta-ads");
    expect(await screen.findByRole("heading", { level: 2, name: "Cada venta del chat, de vuelta a tus anuncios" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /del chat de WhatsApp al bloque Pixel/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Píxel" })).toHaveAccessibleDescription("Sin conectar");

    await userEvent.click(screen.getByRole("button", { name: "Conectar píxel" }));
    expect(screen.getByRole("dialog", { name: "Conectar un píxel de Meta" })).toBeInTheDocument();
  });

  it("Rendimiento muestra la tabla en blanco y lleva a Cuentas; la sección viaja en la dirección", async () => {
    renderAt("/meta-ads");
    await userEvent.click(screen.getByRole("tab", { name: "Rendimiento" }));
    expect(screen.getByRole("heading", { level: 2, name: "Tus campañas, medidas en ventas" })).toBeInTheDocument();
    expect(screen.getByTestId("where")).toHaveTextContent("/meta-ads?tab=performance");

    await userEvent.click(screen.getByRole("button", { name: "Conectar cuenta" }));
    expect(screen.getByRole("tab", { name: "Cuentas" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("heading", { level: 2, name: "Conecta tu cuenta de Meta" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Conectar con Meta" })).toBeDisabled();
    expect(screen.getByTestId("where")).toHaveTextContent("/meta-ads?tab=accounts");
  });

  it("las tarjetas se recorren con las flechas, Inicio y Fin, como pestañas", async () => {
    renderAt("/meta-ads");
    screen.getByRole("tab", { name: "Píxel" }).focus();

    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Rendimiento" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Rendimiento" })).toHaveFocus();

    await userEvent.keyboard("{End}");
    expect(screen.getByRole("tab", { name: "Cuentas" })).toHaveFocus();

    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Píxel" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Píxel" })).toHaveFocus();
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
