import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../../src/shared/test-utils/renderWithProviders";
import { AppSidebar } from "../../src/shared/ui/AppSidebar";
import { BRAND_NAME } from "../../src/shared/brand/brand";

// ---------------------------------------------------------------------------
// La barra lateral: el trabajo del día, con lo mejor de Leona, FunnelChat y
// Vyper en 11 opciones (sin «Pronto»). Lo administrativo vive en el menú de la
// cuenta, la tarjeta de abajo.
// ---------------------------------------------------------------------------

function renderSidebar(initialPath = "/automations") {
  return renderWithProviders(<AppSidebar />, { initialPath });
}

const ORDER = [
  ["Dashboard", "/dashboard"],
  ["Conversaciones", "/conversations"],
  ["CRM", "/crm"],
  ["Automatizaciones", "/automations"],
  ["Agentes de IA", "/ai-agents"],
  ["Difusiones", "/broadcasts"],
  ["Grupos y comunidades", "/groups"],
  ["Meta Ads", "/meta-ads"],
  ["Ventas", "/sales"],
  ["Conexiones", "/connections"],
  ["Integraciones", "/integrations"]
] as const;

describe("AppSidebar", () => {
  it("muestra la marca", () => {
    renderSidebar();
    expect(screen.getByText(BRAND_NAME)).toBeInTheDocument();
  });

  it("tiene las 11 opciones en su orden, cada una con su ruta y sin «Pronto»", () => {
    renderSidebar();
    const links = screen.getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual(ORDER.map(([label]) => label));
    ORDER.forEach(([label, path]) => {
      expect(screen.getByRole("link", { name: label })).toHaveAttribute("href", path);
    });
    expect(screen.queryByText("Pronto")).not.toBeInTheDocument();
  });

  it.each(ORDER)("marca «%s» como activa en %s (y solo esa)", (label, path) => {
    renderSidebar(path);
    expect(screen.getByRole("link", { name: label })).toHaveClass("is-active");
    expect(document.querySelectorAll(".app-sidebar__item.is-active")).toHaveLength(1);
  });

  it("lo administrativo vive en la tarjeta de la cuenta, abajo (estándar con barra lateral)", () => {
    renderSidebar();
    ["Contactos", "Equipo", "Facturación", "Mi perfil", "Configuración", "Ayuda"].forEach((label) => {
      expect(screen.queryByRole("link", { name: label })).not.toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /^Cuenta de/ })).toHaveAttribute("aria-haspopup", "menu");
  });
});
