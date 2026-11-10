import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { accountRoutes } from "../../src/app/router/accountRoutes";
import { lastAppLocation, rememberAppLocation } from "../../src/shared/navigation/lastAppLocation";

// ---------------------------------------------------------------------------
// Configuración a pantalla completa: menú propio (Tu cuenta / Empresa), la
// sección activa con su encabezado, «Volver a Auream» a la última pantalla de
// trabajo, y las direcciones de antes llevan a su sección.
// ---------------------------------------------------------------------------

vi.mock("../../src/app/router/ProtectedRoute", () => ({ ProtectedRoute: ({ children }: { children: JSX.Element }) => children }));
vi.mock("@features/account/components/ProfileSettings", () => ({ ProfileSettings: () => <p>contenido de Mi perfil</p> }));
vi.mock("@features/account/components/AppearanceSettings", () => ({ AppearanceSettings: () => <p>contenido de Apariencia</p> }));
vi.mock("@features/account/components/CompanySettings", () => ({ CompanySettings: () => <p>contenido de General</p> }));
vi.mock("@features/team/components/TeamSettings", () => ({ TeamSettings: () => <p>contenido de Equipo</p> }));

function Where() {
  const location = useLocation();
  return <span data-testid="where">{location.pathname}</span>;
}

const open = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        {accountRoutes()}
        <Route path="*" element={<p>pantalla de la app</p>} />
      </Routes>
      <Where />
    </MemoryRouter>
  );

beforeEach(() => {
  window.sessionStorage.clear();
});

describe("Configuración", () => {
  it("muestra su menú por grupos, marca la sección activa y pone su contenido con encabezado", () => {
    open("/settings/team");
    const nav = screen.getByRole("navigation", { name: "Configuración" });
    expect(within(nav).getByText("Tu cuenta")).toBeInTheDocument();
    expect(within(nav).getByText("Empresa")).toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: /Equipo/ })).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("link", { name: /Plan y pagos/ })).toHaveTextContent("Pronto");
    expect(screen.getByRole("heading", { level: 1, name: "Equipo" })).toBeInTheDocument();
    expect(screen.getByText("contenido de Equipo")).toBeInTheDocument();
  });

  it("cambia de sección desde el menú", async () => {
    open("/settings/general");
    await userEvent.click(screen.getByRole("link", { name: /Mi perfil/ }));
    expect(screen.getByTestId("where")).toHaveTextContent("/settings/profile");
    expect(screen.getByText("contenido de Mi perfil")).toBeInTheDocument();
  });

  it("lo que llega más adelante se ve como «Muy pronto»", () => {
    open("/settings/billing");
    expect(screen.getByRole("heading", { level: 1, name: "Plan y pagos" })).toBeInTheDocument();
    expect(screen.getByText("Muy pronto")).toBeInTheDocument();
  });

  it("«Volver a Auream» regresa a la última pantalla de trabajo (o al inicio)", async () => {
    rememberAppLocation("/conversations");
    open("/settings/appearance");
    await userEvent.click(screen.getByRole("link", { name: "Volver a Auream" }));
    expect(screen.getByTestId("where")).toHaveTextContent("/conversations");
  });

  it("una sección que no existe lleva a General", () => {
    open("/settings/no-existe");
    expect(screen.getByTestId("where")).toHaveTextContent("/settings/general");
  });

  it.each([
    ["/settings", "/settings/general"],
    ["/settings?tab=team", "/settings/team"],
    ["/settings?tab=appearance", "/settings/appearance"],
    ["/profile", "/settings/profile"],
    ["/team", "/settings/team"],
    ["/billing", "/settings/billing"]
  ])("la dirección de antes %s lleva a %s", (from, to) => {
    open(from);
    expect(screen.getByTestId("where")).toHaveTextContent(new RegExp(`^${to}$`));
  });
});

describe("la última pantalla de trabajo", () => {
  it("se recuerda, pero nunca una de Configuración; sin nada guardado es el inicio", () => {
    expect(lastAppLocation()).toBe("/");
    rememberAppLocation("/automations/abc");
    expect(lastAppLocation()).toBe("/automations/abc");
    rememberAppLocation("/settings/team");
    expect(lastAppLocation()).toBe("/");
  });
});
