import { describe, expect, it } from "vitest";
import { BcvOfficialSource, OpenErApiSource } from "../../infrastructure/fx/FxSources.js";

// ---------------------------------------------------------------------------
// Las fuentes oficiales de las tasas: el bolívar del BCV (por DolarApi,
// fuente «oficial») y las demás de open.er-api. Lo que no es una respuesta
// válida y reciente no se acepta: nunca se inventa una tasa.
// ---------------------------------------------------------------------------

const json = (body: unknown, status = 200) => async () => new Response(JSON.stringify(body), { status });
const NOW = () => new Date("2026-11-12T15:00:00.000Z");

describe("BcvOfficialSource", () => {
  it("toma el promedio oficial del BCV", async () => {
    const source = new BcvOfficialSource(json({ moneda: "USD", fuente: "oficial", promedio: 904.4485, fechaActualizacion: "2026-11-12T00:00:00-04:00" }), NOW);
    expect(await source.fetch()).toEqual({ VES: { perUsd: 904.4485 } });
  });

  it("no acepta el paralelo, una tasa vieja ni una respuesta rota", async () => {
    await expect(new BcvOfficialSource(json({ moneda: "USD", fuente: "paralelo", promedio: 1073, fechaActualizacion: "2026-11-12T00:00:00Z" }), NOW).fetch()).rejects.toThrow(/BCV/);
    await expect(new BcvOfficialSource(json({ moneda: "USD", fuente: "oficial", promedio: 880, fechaActualizacion: "2026-10-30T00:00:00Z" }), NOW).fetch()).rejects.toThrow(/vieja/);
    await expect(new BcvOfficialSource(json({ moneda: "USD", fuente: "oficial", promedio: 0 }), NOW).fetch()).rejects.toThrow(/BCV/);
    await expect(new BcvOfficialSource(json({}, 503), NOW).fetch()).rejects.toThrow();
  });
});

describe("OpenErApiSource", () => {
  it("solo las monedas de Auream, con valores válidos", async () => {
    const source = new OpenErApiSource(json({ result: "success", rates: { COP: 3301.6, VES: 904.4485, JPY: 150, MXN: -1 } }), ["COP", "VES", "MXN"]);
    expect(await source.fetch()).toEqual({ COP: { perUsd: 3301.6 }, VES: { perUsd: 904.4485 } });
    await expect(new OpenErApiSource(json({ result: "error" }), ["COP"]).fetch()).rejects.toThrow(/open.er-api/);
  });
});
