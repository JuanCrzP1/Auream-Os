import { describe, expect, it } from "vitest";
import { joinPhone, splitPhone } from "../../src/features/account/phone";
import { cityOf, timezoneOptions } from "../../src/features/account/timezones";
import { resolveTheme } from "../../src/shared/theme/contracts/Theme";
import { themeStore } from "../../src/shared/theme/storage/themeStore";

describe("teléfono con prefijo", () => {
  it("separa el prefijo más largo de los países de Auream y vuelve a unirlo", () => {
    expect(splitPhone("+573001234567")).toEqual({ dial: "57", number: "3001234567" });
    expect(splitPhone(null)).toEqual({ dial: "57", number: "" });
    expect(joinPhone("52", "55 1234 5678")).toBe("+525512345678");
    expect(joinPhone("57", "  ")).toBeNull();
  });
});

describe("zonas horarias", () => {
  it("nombra la ciudad y pone primero las de los países de Auream", () => {
    expect(cityOf("America/Argentina/Buenos_Aires")).toBe("Buenos Aires, Argentina");
    expect(cityOf("America/Argentina/Cordoba")).toBe("Cordoba");
    const { common } = timezoneOptions("America/Bogota");
    expect(common[0]!.value).toBe("America/Bogota");
    expect(common[0]!.label).toBe("Bogotá, Colombia · GMT-5");
  });
});

describe("tema del sistema", () => {
  it("«sistema» sigue al equipo y se guarda como preferencia", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
    expect(resolveTheme("light", true)).toBe("light");
    themeStore.write("system");
    expect(themeStore.read()).toBe("system");
    themeStore.clear();
  });
});
