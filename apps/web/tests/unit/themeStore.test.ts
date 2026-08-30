import { describe, it, expect, beforeEach } from "vitest";
import { themeStore } from "../../src/shared/theme/storage/themeStore";

describe("themeStore", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("devuelve null cuando el usuario nunca ha elegido tema", () => {
    expect(themeStore.read()).toBeNull();
  });

  it("persiste la elección del usuario", () => {
    themeStore.write("dark");
    expect(themeStore.read()).toBe("dark");
  });

  it("ignora valores corruptos en el almacenamiento", () => {
    window.localStorage.setItem("bots-ai-theme", "neon");
    expect(themeStore.read()).toBeNull();
  });

  it("olvida la elección al limpiar", () => {
    themeStore.write("light");
    themeStore.clear();
    expect(themeStore.read()).toBeNull();
  });
});
