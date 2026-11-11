import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../../src/shared/test-utils/renderWithProviders";
import { AppShell } from "../../src/shared/ui/app-shell/AppShell";

// ---------------------------------------------------------------------------
// La barra lateral: en PC se contrae a íconos (botón o Ctrl/⌘ + B) y se
// recuerda; los nombres siguen ahí para quien no ve la pantalla. En celular
// se abre con ☰ y se cierra con ✕, tocando fuera, con Escape o al elegir una
// opción (se abre esa pantalla y el menú se esconde).
// ---------------------------------------------------------------------------

const mobile = (matches: boolean) =>
  vi.stubGlobal("matchMedia", (query: string) => ({ matches, media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));

const shell = () => renderWithProviders(<AppShell><p>Contenido</p></AppShell>, { initialPath: "/crm" });
const sidebar = () => document.getElementById("app-sidebar")!;
const menuOpen = () => document.querySelector(".app-shell")!.classList.contains("is-menu-open");

beforeEach(() => {
  window.localStorage.clear();
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ items: [], unread: 0 }), text: async () => "{}" })));
  mobile(false);
});

describe("Barra lateral contraíble", () => {
  it("PC: se contrae a íconos, los nombres siguen accesibles y se recuerda", async () => {
    const view = shell();
    await userEvent.click(screen.getByRole("button", { name: "Contraer menú" }));
    expect(sidebar()).toHaveClass("is-collapsed");
    expect(screen.getByRole("link", { name: "Conversaciones" })).toHaveAttribute("data-label", "Conversaciones");
    expect(screen.getByRole("button", { name: "Expandir menú" })).toHaveAttribute("aria-expanded", "false");
    expect(window.localStorage.getItem("auream.sidebar.collapsed")).toBe("1");
    view.unmount();
    shell();
    expect(sidebar()).toHaveClass("is-collapsed");
  });

  it("PC: Ctrl/⌘ + B contrae y expande, pero no mientras escribes", () => {
    shell();
    fireEvent.keyDown(window, { key: "b", ctrlKey: true });
    expect(sidebar()).toHaveClass("is-collapsed");
    fireEvent.keyDown(window, { key: "b", metaKey: true });
    expect(sidebar()).not.toHaveClass("is-collapsed");
    const input = document.createElement("input");
    document.body.appendChild(input);
    fireEvent.keyDown(input, { key: "b", ctrlKey: true });
    expect(sidebar()).not.toHaveClass("is-collapsed");
    input.remove();
  });

  it("celular: ☰ abre el menú y se cierra con ✕, tocando fuera, Escape o al elegir una opción", async () => {
    mobile(true);
    shell();
    const burger = screen.getByRole("button", { name: "Abrir menú" });
    await userEvent.click(burger);
    expect(menuOpen()).toBe(true);
    expect(burger).toHaveAttribute("aria-expanded", "true");
    await userEvent.click(screen.getByRole("button", { name: "Cerrar menú" }));
    expect(menuOpen()).toBe(false);

    await userEvent.click(burger);
    fireEvent.click(document.querySelector(".app-shell__backdrop")!);
    expect(menuOpen()).toBe(false);

    await userEvent.click(burger);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(menuOpen()).toBe(false);

    await userEvent.click(burger);
    await userEvent.click(screen.getByRole("link", { name: "Conversaciones" }));
    await waitFor(() => expect(menuOpen()).toBe(false));
    expect(screen.getByRole("link", { name: "Conversaciones" })).toHaveClass("is-active");
  });
});
