import { describe, expect, it } from "vitest";
import { countryOfPhone, formatPhone } from "@shared/phone/formatPhone";

describe("formatPhone", () => {
  it("separa el indicativo y agrupa el número como se lee", () => {
    expect(formatPhone("573013815302")).toEqual({ text: "+57 301 381 5302", flag: "🇨🇴" });
    expect(formatPhone("5215512345678").text).toBe("+52 1 551 234 5678");
    expect(formatPhone("593991234567").text).toBe("+593 99 123 4567");
  });

  it("reconoce el indicativo más largo primero (Ecuador antes que otros 59…)", () => {
    expect(countryOfPhone("593991234567")?.code).toBe("EC");
  });

  it("sin país conocido, muestra el número igual", () => {
    expect(formatPhone("99912345678")).toEqual({ text: "+9 991 234 5678", flag: null });
  });
});
