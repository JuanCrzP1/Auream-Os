import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../../src/shared/test-utils/renderWithProviders";
import { AppSidebar } from "../../src/shared/ui/AppSidebar";
import { BRAND_NAME } from "../../src/shared/brand/brand";

function renderSidebar(initialPath = "/automations") {
  return renderWithProviders(<AppSidebar />, { initialPath });
}

describe("AppSidebar", () => {
  it("renders Automatizaciones nav item", () => {
    renderSidebar();
    expect(screen.getByText("Automatizaciones")).toBeInTheDocument();
  });

  it("renders brand name", () => {
    renderSidebar();
    expect(screen.getByText(BRAND_NAME)).toBeInTheDocument();
  });

  it("marks Automatizaciones as active when on /automations", () => {
    renderSidebar("/automations");
    const link = screen.getByText("Automatizaciones").closest("a");
    expect(link).toHaveClass("is-active");
  });

  it("does not mark Dashboard as active when on /automations", () => {
    renderSidebar("/automations");
    const link = screen.getByText("Dashboard").closest("a");
    expect(link).not.toHaveClass("is-active");
  });

  it("renders all main nav items", () => {
    renderSidebar();
    const labels = ["Dashboard", "Conversaciones", "Automatizaciones", "Contactos", "Integraciones"];
    labels.forEach((label) => {
      expect(screen.getByText(label)).toBeInTheDocument();
    });
  });

  // ---- Nuevos módulos ----

  it("renders Conexiones nav item", () => {
    renderSidebar();
    expect(screen.getByText("Conexiones")).toBeInTheDocument();
  });

  it("renders AI Agents nav item", () => {
    renderSidebar();
    expect(screen.getByText("AI Agents")).toBeInTheDocument();
  });

  it("marks Conexiones as active when on /connections", () => {
    renderSidebar("/connections");
    const link = screen.getByText("Conexiones").closest("a");
    expect(link).toHaveClass("is-active");
  });

  it("marks AI Agents as active when on /ai-agents", () => {
    renderSidebar("/ai-agents");
    const link = screen.getByText("AI Agents").closest("a");
    expect(link).toHaveClass("is-active");
  });

  it("does not mark Automatizaciones as active when on /connections", () => {
    renderSidebar("/connections");
    const link = screen.getByText("Automatizaciones").closest("a");
    expect(link).not.toHaveClass("is-active");
  });

  it("does not mark Integraciones as active when on /ai-agents", () => {
    renderSidebar("/ai-agents");
    const link = screen.getByText("Integraciones").closest("a");
    expect(link).not.toHaveClass("is-active");
  });

  it("Conexiones aparece después de Automatizaciones en el orden", () => {
    renderSidebar();
    const items = screen.getAllByRole("link");
    const labels = items.map((el) => el.textContent ?? "");
    const idxAuto = labels.findIndex((l) => l.includes("Automatizaciones"));
    const idxConn = labels.findIndex((l) => l.includes("Conexiones"));
    expect(idxConn).toBeGreaterThan(idxAuto);
  });

  it("AI Agents aparece inmediatamente después de Automatizaciones en el orden", () => {
    renderSidebar();
    const items = screen.getAllByRole("link");
    const labels = items.map((el) => el.textContent ?? "");
    const idxAuto = labels.findIndex((l) => l.includes("Automatizaciones"));
    const idxAI = labels.findIndex((l) => l.includes("AI Agents"));
    expect(idxAI).toBe(idxAuto + 1);
  });

  it("Conexiones aparece antes de Contactos en el orden", () => {
    renderSidebar();
    const items = screen.getAllByRole("link");
    const labels = items.map((el) => el.textContent ?? "");
    const idxConn = labels.findIndex((l) => l.includes("Conexiones"));
    const idxContact = labels.findIndex((l) => l.includes("Contactos"));
    expect(idxConn).toBeLessThan(idxContact);
  });

  it("la navegación principal es el trabajo del día (7 opciones)", () => {
    renderSidebar();
    const labels = screen.getAllByRole("link").map((el) => el.textContent ?? "");
    expect(labels).toEqual(["Dashboard", "Conversaciones", "Automatizaciones", "AI Agents", "Conexiones", "Contactos", "Integraciones"]);
  });

  it("lo administrativo vive en la tarjeta de la cuenta, abajo (estándar con barra lateral)", () => {
    renderSidebar();
    ["Equipo", "Facturación", "Mi perfil", "Configuración", "Ayuda"].forEach((label) => {
      expect(screen.queryByRole("link", { name: label })).not.toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /^Cuenta de/ })).toHaveAttribute("aria-haspopup", "menu");
  });
});
