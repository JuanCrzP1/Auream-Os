import { describe, it, expect, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../../src/shared/test-utils/renderWithProviders";
import { ThemeToggleButton } from "../../src/shared/theme/components/ThemeToggleButton";
import { themeStore } from "../../src/shared/theme/storage/themeStore";

describe("ThemeToggleButton", () => {
  beforeEach(() => {
    window.localStorage.clear();
    delete document.documentElement.dataset.theme;
  });

  it("arranca en oscuro cuando nadie ha elegido tema", () => {
    renderWithProviders(<ThemeToggleButton />);

    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(screen.getByRole("button", { name: /modo claro/i })).toBeInTheDocument();
  });

  it("aplica el tema claro al documento al pulsar", async () => {
    renderWithProviders(<ThemeToggleButton />);

    await userEvent.click(screen.getByRole("button", { name: /modo claro/i }));

    expect(document.documentElement.dataset.theme).toBe("light");
    expect(screen.getByRole("button", { name: /modo oscuro/i })).toBeInTheDocument();
  });

  it("persiste la elección para la siguiente carga", async () => {
    renderWithProviders(<ThemeToggleButton />);

    await userEvent.click(screen.getByRole("button", { name: /modo claro/i }));

    expect(themeStore.read()).toBe("light");
  });

  it("respeta el tema persistido al montar", () => {
    themeStore.write("light");

    renderWithProviders(<ThemeToggleButton />);

    expect(document.documentElement.dataset.theme).toBe("light");
    expect(screen.getByRole("button", { name: /modo oscuro/i })).toHaveAttribute("aria-pressed", "false");
  });

  it("marca aria-pressed cuando el tema activo es oscuro", () => {
    themeStore.write("dark");

    renderWithProviders(<ThemeToggleButton />);

    expect(screen.getByRole("button", { name: /modo claro/i })).toHaveAttribute("aria-pressed", "true");
  });
});
