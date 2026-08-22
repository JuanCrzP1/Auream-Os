import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AppRouter } from "../../src/app/router/AppRouter";

function renderRouter(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <AppRouter />
    </MemoryRouter>
  );
}

describe("AppRouter", () => {
  it("redirects / to /automations", () => {
    renderRouter("/");
    expect(screen.getByRole("heading", { name: /automatizaciones/i })).toBeInTheDocument();
  });

  it("redirects unknown routes to /automations", () => {
    renderRouter("/some/unknown/path");
    expect(screen.getByRole("heading", { name: /automatizaciones/i })).toBeInTheDocument();
  });

  it("renders templates page at /automations/templates", () => {
    renderRouter("/automations/templates");
    expect(screen.getByText(/plantillas/i)).toBeInTheDocument();
  });

  it("renders archive page at /automations/archive", () => {
    renderRouter("/automations/archive");
    expect(screen.getByText(/archivo/i)).toBeInTheDocument();
  });

  it("renders hub page at /automations", () => {
    renderRouter("/automations");
    expect(screen.getByRole("heading", { name: /automatizaciones/i })).toBeInTheDocument();
  });

  it("renders hub for /builder without flowKey redirect", () => {
    renderRouter("/builder/");
    expect(screen.getByRole("heading", { name: /automatizaciones/i })).toBeInTheDocument();
  });

  // ---- Nuevas rutas ----

  it("renders ConnectionsPage at /connections", () => {
    renderRouter("/connections");
    expect(screen.getByRole("heading", { name: /conexiones/i })).toBeInTheDocument();
  });

  it("renders AiAgentsPage at /ai-agents", () => {
    renderRouter("/ai-agents");
    expect(screen.getByRole("heading", { name: /ai agents/i })).toBeInTheDocument();
  });

  it("ConnectionsPage shows correct description", () => {
    renderRouter("/connections");
    expect(screen.getByText(/administra instancias, estados y conexiones/i)).toBeInTheDocument();
  });

  it("AiAgentsPage shows correct description", () => {
    renderRouter("/ai-agents");
    expect(screen.getByText(/administra agentes inteligentes/i)).toBeInTheDocument();
  });

  it("Automatizaciones route still works after adding new routes", () => {
    renderRouter("/automations");
    expect(screen.getByRole("heading", { name: /automatizaciones/i })).toBeInTheDocument();
  });

  it("unknown routes still redirect to automations after new routes added", () => {
    renderRouter("/some-totally-unknown-path");
    expect(screen.getByRole("heading", { name: /automatizaciones/i })).toBeInTheDocument();
  });
});
