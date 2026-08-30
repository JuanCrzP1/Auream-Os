import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "../../src/shared/test-utils/renderWithProviders";
import { AppRouter } from "../../src/app/router/AppRouter";

// ---------------------------------------------------------------------------
// Las rutas privadas están protegidas: sin sesión llevan a /login.
// Estos tests fijan esa garantía, que es la razón de ser de ProtectedRoute.
// ---------------------------------------------------------------------------

function renderRouter(initialPath: string) {
  return renderWithProviders(<AppRouter />, { initialPath });
}

/** Simula "no hay sesión": el proveedor de identidad responde sin usuario. */
function withoutSession() {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => null } as Response)
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
  withoutSession();
});

describe("AppRouter — rutas públicas", () => {
  it("muestra el login en /login", async () => {
    renderRouter("/login");

    expect(await screen.findByRole("heading", { name: /inicia sesión/i })).toBeInTheDocument();
  });

  it("muestra el registro en /register", async () => {
    renderRouter("/register");

    expect(await screen.findByRole("heading", { name: /crear cuenta/i })).toBeInTheDocument();
  });
});

describe("AppRouter — rutas protegidas sin sesión", () => {
  it.each([
    ["/", "raíz"],
    ["/automations", "hub"],
    ["/automations/templates", "plantillas"],
    ["/automations/archive", "archivo"],
    ["/connections", "conexiones"],
    ["/ai-agents", "ai agents"],
    ["/builder/flow-1", "builder"],
    ["/ruta/desconocida", "desconocida"]
  ])("redirige %s a /login", async (path) => {
    renderRouter(path);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /inicia sesión/i })).toBeInTheDocument();
    });
  });

  it("no renderiza contenido privado mientras comprueba la sesión", () => {
    renderRouter("/automations");

    expect(screen.queryByRole("heading", { name: /automatizaciones/i })).not.toBeInTheDocument();
  });
});
