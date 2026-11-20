import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { ThemeProvider } from "../../src/shared/theme/context/ThemeContext";
import { AccountCard } from "../../src/shared/account/AccountCard";

// ---------------------------------------------------------------------------
// La tarjeta de la cuenta (abajo en la barra lateral) y su menú estándar:
// quién eres, tu empresa (solo para cambiar de empresa), Mi perfil,
// Configuración (donde viven Equipo y Plan y pagos), el tema, Ayuda (el
// Centro de ayuda) y cerrar sesión. Con teclado.
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
const ONE = [{ tenantId: "t1", tenantKey: "t1", tenantName: "Dilo Cantando", role: "tenant_owner" }];
const TWO = [...ONE, { tenantId: "t2", tenantKey: "t2", tenantName: "Restauraciones Lara", role: "operator" }];
const tenancy = { tenants: ONE, selectTenant: vi.fn() };
vi.mock("@shared/auth/tenant/ActiveTenantContext", () => ({
  useActiveTenant: () => ({ state: { status: "ready", tenants: tenancy.tenants }, activeTenantId: "t1", selectTenant: tenancy.selectTenant })
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
  tenancy.tenants = ONE;
  tenancy.selectTenant = vi.fn();
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

  it("abre el menú estándar: identidad, tu empresa con tu rol y las opciones", async () => {
    renderCard();
    await userEvent.click(screen.getByRole("button", { name: "Cuenta de Juan Camilo" }));
    const menu = screen.getByRole("menu", { name: "Menú de la cuenta" });
    expect(menu).toHaveTextContent("juan@example.com");
    expect(menu).toHaveTextContent("Dilo CantandoDueño");
    // Equipo, Plan y pagos y lo demás viven dentro de Configuración.
    expect(screen.getAllByRole("menuitem").map((item) => item.textContent)).toEqual(["Mi perfil", "Configuración", "Ayuda", "Cerrar sesión"]);
    // El foco entra al menú.
    expect(screen.getByRole("menuitem", { name: "Mi perfil" })).toHaveFocus();
  });

  it("la flecha junto al nombre y el correo baja el menú (se desliza y se quita) y devuelve el foco a la tarjeta", async () => {
    renderCard();
    const card = screen.getByRole("button", { name: "Cuenta de Juan Camilo" });
    await userEvent.click(card);
    await userEvent.click(screen.getByRole("button", { name: "Cerrar el menú" }));
    expect(screen.getByRole("menu")).toHaveClass("is-closing");
    expect(card).toHaveAttribute("aria-expanded", "false");
    expect(card).toHaveFocus();
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
  });

  it("con una sola empresa, su tarjeta solo la muestra: no se toca ni lleva a Configuración", async () => {
    renderCard();
    await userEvent.click(screen.getByRole("button", { name: "Cuenta de Juan Camilo" }));
    const company = screen.getByText("Dilo Cantando", { selector: ".account-company strong" }).closest(".account-company")!;
    expect(company.tagName).toBe("DIV");
    expect(company.querySelector("a, button, svg[class]")).toBeNull();
    await userEvent.click(company);
    expect(screen.getByTestId("where")).toHaveTextContent("/automations");
    expect(screen.getByRole("menu")).toBeInTheDocument();
  });

  it("con varias empresas, su tarjeta despliega la lista para cambiar, con la actual marcada; Escape la recoge sin cerrar el menú", async () => {
    tenancy.tenants = TWO;
    renderCard();
    await userEvent.click(screen.getByRole("button", { name: "Cuenta de Juan Camilo" }));
    const toggle = screen.getByRole("menuitem", { name: "Dilo Cantando, Dueño. Cambiar de empresa" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("group", { name: "Cambiar de empresa" })).not.toBeInTheDocument();

    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    const list = screen.getByRole("group", { name: "Cambiar de empresa" });
    expect(within(list).getByRole("menuitemradio", { name: "Dilo Cantando" })).toHaveAttribute("aria-checked", "true");
    expect(within(list).getByRole("menuitemradio", { name: "Restauraciones Lara" })).toHaveAttribute("aria-checked", "false");

    within(list).getByRole("menuitemradio", { name: "Restauraciones Lara" }).focus();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("group", { name: "Cambiar de empresa" })).not.toBeInTheDocument();
    expect(screen.getByRole("menu")).toBeInTheDocument();
    expect(toggle).toHaveFocus();
    expect(screen.getByTestId("where")).toHaveTextContent("/automations");
  });

  it("elegir otra empresa la activa y recarga limpio; la actual solo recoge la lista", async () => {
    tenancy.tenants = TWO;
    const assign = vi.fn();
    const original = window.location;
    Object.defineProperty(window, "location", { configurable: true, value: { ...original, assign } });
    try {
      renderCard();
      await userEvent.click(screen.getByRole("button", { name: "Cuenta de Juan Camilo" }));
      await userEvent.click(screen.getByRole("menuitem", { name: /Cambiar de empresa/ }));
      await userEvent.click(screen.getByRole("menuitemradio", { name: "Dilo Cantando" }));
      expect(tenancy.selectTenant).not.toHaveBeenCalled();
      expect(screen.queryByRole("group", { name: "Cambiar de empresa" })).not.toBeInTheDocument();

      await userEvent.click(screen.getByRole("menuitem", { name: /Cambiar de empresa/ }));
      await userEvent.click(screen.getByRole("menuitemradio", { name: "Restauraciones Lara" }));
      expect(tenancy.selectTenant).toHaveBeenCalledWith("t2");
      expect(assign).toHaveBeenCalledWith("/automations");
    } finally {
      Object.defineProperty(window, "location", { configurable: true, value: original });
    }
  });

  it("navega a Mi perfil y se cierra; Escape o tocar otra vez la tarjeta lo cierran y devuelven el foco a la tarjeta", async () => {
    renderCard();
    const card = screen.getByRole("button", { name: "Cuenta de Juan Camilo" });
    await userEvent.click(card);
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
    expect(card).toHaveFocus();

    await userEvent.click(card);
    await userEvent.click(card);
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());

    await userEvent.click(card);
    await userEvent.click(screen.getByRole("menuitem", { name: "Mi perfil" }));
    expect(screen.getByTestId("where")).toHaveTextContent("/settings/profile");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("las flechas recorren las opciones; Configuración lleva a General", async () => {
    renderCard();
    await userEvent.click(screen.getByRole("button", { name: "Cuenta de Juan Camilo" }));
    await userEvent.keyboard("{ArrowDown}");
    expect(screen.getByRole("menuitem", { name: "Configuración" })).toHaveFocus();
    await userEvent.keyboard("{End}");
    expect(screen.getByRole("menuitem", { name: "Cerrar sesión" })).toHaveFocus();
    await userEvent.keyboard("{Home}");
    expect(screen.getByRole("menuitem", { name: "Mi perfil" })).toHaveFocus();
    await userEvent.keyboard("{ArrowDown}{Enter}");
    expect(screen.getByTestId("where")).toHaveTextContent("/settings/general");
  });

  it("elige el tema (claro, oscuro o el del sistema) y cierra sesión", async () => {
    renderCard();
    await userEvent.click(screen.getByRole("button", { name: "Cuenta de Juan Camilo" }));
    await userEvent.click(screen.getByRole("menuitemradio", { name: "Sistema" }));
    expect(screen.getByRole("menuitemradio", { name: "Sistema" })).toHaveAttribute("aria-checked", "true");
    expect(window.localStorage.getItem("bots-ai-theme")).toBe("system");

    // «Cerrar sesión» se ve como las demás opciones (el rojo es para borrar cosas).
    expect(screen.getByRole("menuitem", { name: "Cerrar sesión" }).className).toBe("account-menu__item");
    await userEvent.click(screen.getByRole("menuitem", { name: "Cerrar sesión" }));
    expect(signOut).toHaveBeenCalledTimes(1);
  });
});
