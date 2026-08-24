import { describe, expect, it } from "vitest";
import { loadApiConfig } from "../../apps/api/config/loadApiConfig.js";

const VALID_SECRET = "x".repeat(32);

describe("loadApiConfig", () => {
  it("rechaza credenciales de desarrollo en produccion", () => {
    expect(() =>
      loadApiConfig({
        NODE_ENV: "production",
        JWT_SECRET: VALID_SECRET,
        CORS_ALLOWED_ORIGINS: "https://app.example.com",
        DEV_API_KEY: "cualquier-clave"
      })
    ).toThrow(/no pueden existir en producción/);
  });

  it("exige una allowlist de CORS en produccion", () => {
    expect(() =>
      loadApiConfig({ NODE_ENV: "production", JWT_SECRET: VALID_SECRET })
    ).toThrow(/CORS_ALLOWED_ORIGINS es obligatorio/);
  });

  it("nunca expone devApiKey en produccion", () => {
    const config = loadApiConfig({
      NODE_ENV: "production",
      JWT_SECRET: VALID_SECRET,
      CORS_ALLOWED_ORIGINS: "https://app.example.com"
    });

    expect(config.devApiKey).toBeNull();
    expect(config.isProduction).toBe(true);
  });

  it("permite una API key de desarrollo fuera de produccion", () => {
    const config = loadApiConfig({ JWT_SECRET: VALID_SECRET, DEV_API_KEY: "bfk_clave-local" });

    expect(config.devApiKey).toBe("bfk_clave-local");
    expect(config.allowedOrigins).toContain("http://localhost:5173");
  });

  it("rechaza una DEV_API_KEY sin el prefijo que exige el verificador", () => {
    expect(() =>
      loadApiConfig({ JWT_SECRET: VALID_SECRET, DEV_API_KEY: "sin-prefijo" })
    ).toThrow(/debe empezar por "bfk_"/);
  });

  it("parsea la allowlist de origenes separada por comas", () => {
    const config = loadApiConfig({
      JWT_SECRET: VALID_SECRET,
      CORS_ALLOWED_ORIGINS: "https://a.example.com, https://b.example.com"
    });

    expect(config.allowedOrigins).toEqual(["https://a.example.com", "https://b.example.com"]);
  });
});
