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

  it("arranca en claro cuando el sistema no pide oscuro", () => {
    renderWithProviders(<ThemeToggleButton />);
    expect(screen.getByRole("button", { name: /modo oscuro/i })).toBeInTheDocument();
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("aplica el tema oscuro al documento al pulsar", async () => {
    renderWithProviders(<ThemeToggleButton />);

    await userEvent.click(screen.getByRole("button", { name: /modo oscuro/i }));

    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(screen.getByRole("button", { name: /modo claro/i })).toBeInTheDocument();
  });

  it("persiste la elección para la siguiente carga", async () => {
    renderWithProviders(<ThemeToggleButton />);

    await userEvent.click(screen.getByRole("button", { name: /modo oscuro/i }));

    expect(themeStore.read()).toBe("dark");
  });

  it("respeta el tema persistido al montar", () => {
    themeStore.write("dark");

    renderWithProviders(<ThemeToggleButton />);

    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(screen.getByRole("button", { name: /modo claro/i })).toHaveAttribute("aria-pressed", "true");
  });
});
