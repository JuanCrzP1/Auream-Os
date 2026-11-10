import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { ThemeProvider } from "../../src/shared/theme/context/ThemeContext";
import { AccountCard } from "../../src/shared/account/AccountCard";

// ---------------------------------------------------------------------------
// La tarjeta de la cuenta (abajo en la barra lateral) y su menú estándar:
// quién eres, tu empresa, Mi perfil y Empresa, lo que llega «Pronto» (Equipo,
// Pagos y suscripciones, Ayuda), el tema y cerrar sesión. Con teclado.
// ---------------------------------------------------------------------------

const signOut = vi.fn(async () => undefined);
const account = {
  value: {
    profile: { displayName: "Juan Camilo", phone: null, photoUrl: "https://blob.example/users/u/photo/a.png" },
    company: { name: "Dilo Cantando", timezone: "America/Bogota", timezoneIsDefault: false, logoUrl: null, canEdit: true },
    displayName: "Juan Camilo",
    email: "juan@example.com"
  }
};

vi.mock("@shared/account/AccountContext", () => ({ useAccount: () => account.value }));
vi.mock("@shared/auth/hooks/useSignOut", () => ({ useSignOut: () => signOut }));
vi.mock("@shared/auth/tenant/ActiveTenantContext", () => ({
  useActiveTenant: () => ({
    state: { status: "ready", tenants: [{ tenantId: "t1", tenantKey: "t1", tenantName: "Dilo Cantando", role: "tenant_owner" }] },
    activeTenantId: "t1",
    selectTenant: vi.fn()
  })
}));

function Where() {
  return <span data-testid="where">{useLocation().pathname}</span>;
}

function renderCard() {
  return render(
    <MemoryRouter initialEntries={["/automations"]}>
      <ThemeProvider>
        <AccountCard />
        <Routes>
          <Route path="*" element={<Where />} />
        </Routes>
      </ThemeProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  signOut.mockClear();
  window.localStorage.clear();
});

describe("tarjeta de la cuenta", () => {
  it("muestra tu foto, tu nombre y la empresa activa; el menú empieza cerrado", () => {
    renderCard();
    const card = screen.getByRole("button", { name: "Cuenta de Juan Camilo" });
    expect(card).toHaveAttribute("aria-expanded", "false");
    expect(card).toHaveTextContent("Dilo Cantando");
    expect(card.querySelector("img")).toHaveAttribute("src", "https://blob.example/users/u/photo/a.png");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("abre el menú estándar: identidad, empresa con tu rol, opciones y lo que llega pronto", async () => {
    renderCard();
    await userEvent.click(screen.getByRole("button", { name: "Cuenta de Juan Camilo" }));
    const menu = screen.getByRole("menu", { name: "Menú de la cuenta" });
    expect(menu).toHaveTextContent("juan@example.com");
    expect(menu).toHaveTextContent("Dueño");
    const items = screen.getAllByRole("menuitem").map((item) => item.textContent);
    // La tarjeta de la empresa abre sus datos (Configuración); luego las opciones y lo que llega pronto.
    expect(items).toEqual(["DCDilo CantandoDueño", "Mi perfil", "Configuración", "EquipoPronto", "Pagos y suscripcionesPronto", "AyudaPronto", "Cerrar sesión"]);
    // El foco entra al menú.
    expect(screen.getAllByRole("menuitem")[0]).toHaveFocus();
  });

  it("navega a Mi perfil y se cierra; Escape cierra y devuelve el foco a la tarjeta", async () => {
    renderCard();
    const card = screen.getByRole("button", { name: "Cuenta de Juan Camilo" });
    await userEvent.click(card);
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(card).toHaveFocus();

    await userEvent.click(card);
    await userEvent.click(screen.getByRole("menuitem", { name: "Mi perfil" }));
    expect(screen.getByTestId("where")).toHaveTextContent("/profile");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("las flechas recorren las opciones; la tarjeta de la empresa lleva a Configuración", async () => {
    renderCard();
    await userEvent.click(screen.getByRole("button", { name: "Cuenta de Juan Camilo" }));
    await userEvent.keyboard("{ArrowDown}");
    expect(screen.getByRole("menuitem", { name: "Mi perfil" })).toHaveFocus();
    await userEvent.keyboard("{ArrowDown}");
    expect(screen.getByRole("menuitem", { name: "Configuración" })).toHaveFocus();
    await userEvent.keyboard("{End}");
    expect(screen.getByRole("menuitem", { name: "Cerrar sesión" })).toHaveFocus();
    await userEvent.keyboard("{Home}");
    await userEvent.keyboard("{Enter}");
    expect(screen.getByTestId("where")).toHaveTextContent("/settings");
  });

  it("elige el tema (claro, oscuro o el del sistema) y cierra sesión", async () => {
    renderCard();
    await userEvent.click(screen.getByRole("button", { name: "Cuenta de Juan Camilo" }));
    await userEvent.click(screen.getByRole("menuitemradio", { name: "Sistema" }));
    expect(screen.getByRole("menuitemradio", { name: "Sistema" })).toHaveAttribute("aria-checked", "true");
    expect(window.localStorage.getItem("bots-ai-theme")).toBe("system");

    await userEvent.click(screen.getByRole("menuitem", { name: "Cerrar sesión" }));
    expect(signOut).toHaveBeenCalledTimes(1);
  });
});
