import { describe, expect, it } from "vitest";
import { requireBroadcastDraft } from "../../domains/broadcasts/domain/BroadcastDraft.js";
import { capToday, estimateDays, nextDelayMs, sendingWindow, startOfMonth, warmupDay } from "../../domains/broadcasts/domain/Pace.js";
import { isOptOut, personalize } from "../../domains/broadcasts/domain/Personalize.js";
import { assignVariants, pickWinner, shuffle } from "../../domains/broadcasts/domain/Variants.js";
import { ValidationError } from "../../platform/observability/errors/ValidationError.js";

// ---------------------------------------------------------------------------
// Reglas de las difusiones: lo que se acepta, el ritmo que cuida el número
// (pausas al azar, horario, tope y calentamiento), el nombre de cada persona,
// el «SALIR» y las versiones (al azar o prueba A/B por ventas).
// ---------------------------------------------------------------------------

const NOW = new Date("2026-11-10T15:00:00Z"); // 10:00 a. m. en Bogotá
const BOGOTA = "America/Bogota";
const valid = { name: "Promo", variants: [{ kind: "message", text: "Hola {first_name}", media: null }], connectionIds: ["c1"], audience: {}, settings: {} };

describe("lo que se acepta al crear una difusión", () => {
  it("normaliza y pone el ritmo, el tope y el horario por defecto", () => {
    const draft = requireBroadcastDraft(valid, NOW);
    expect(draft.settings).toEqual({ pace: "normal", dailyCap: 300, fromHour: 8, toHour: 20, optOutFooter: true });
    expect(draft.audience).toEqual({ labelIds: [], excludeLabelIds: [], countries: [], lastInboundDays: null, excludeBoughtDays: null });
    expect(draft.scheduledAt).toBeNull();
  });

  it("rechaza lo que no tiene sentido", () => {
    const bad = (patch: Record<string, unknown>) => () => requireBroadcastDraft({ ...valid, ...patch }, NOW);
    expect(bad({ name: " " })).toThrow(ValidationError);
    expect(bad({ variants: [{ kind: "message", text: "", media: null }] })).toThrow(/vacío/);
    expect(bad({ variants: [valid.variants[0], { kind: "flow", automationId: "f1" }] })).toThrow(/todas flujos o todas mensajes/);
    expect(bad({ variants: Array(4).fill(valid.variants[0]) })).toThrow(/Hasta 3/);
    expect(bad({ connectionIds: [] })).toThrow(/número/);
    expect(bad({ abTest: { sharePercent: 20, decideAfterHours: 6 } })).toThrow(/al menos 2 versiones/);
    expect(bad({ settings: { fromHour: 19, toHour: 20 } })).toThrow(/2 horas/);
    expect(bad({ scheduledAt: "2026-11-01T10:00:00Z" })).toThrow(/ya pasó/);
    expect(bad({ audience: { countries: ["XX"] } })).toThrow(/país/);
    expect(bad({ variants: [{ kind: "message", text: "Mira", media: { type: "audio", url: "https://x" } }] })).toThrow(/foto o un video/);
  });

  it("acepta prueba A/B con 2 versiones y un segundo envío", () => {
    const draft = requireBroadcastDraft(
      { ...valid, variants: [valid.variants[0], { kind: "message", text: "Otra", media: null }], abTest: { sharePercent: 20, decideAfterHours: 6 }, followUp: { afterHours: 48, content: { kind: "message", text: "¿Lo pensaste?", media: null } } },
      NOW
    );
    expect(draft.abTest).toEqual({ sharePercent: 20, decideAfterHours: 6 });
    expect(draft.followUp?.afterHours).toBe(48);
  });
});

describe("el ritmo que cuida el número", () => {
  it("la pausa es al azar dentro del ritmo", () => {
    expect(nextDelayMs("normal", () => 0)).toBe(8000);
    expect(nextDelayMs("normal", () => 1)).toBe(25000);
    expect(nextDelayMs("careful", () => 0.5)).toBe(32500);
  });

  it("solo en el horario del negocio; si no, cuándo abre", () => {
    expect(sendingWindow(NOW, BOGOTA, { fromHour: 8, toHour: 20 }).open).toBe(true);
    const early = sendingWindow(new Date("2026-11-10T11:00:00Z"), BOGOTA, { fromHour: 8, toHour: 20 }); // 6 a. m.
    expect(early).toEqual({ open: false, opensAt: new Date("2026-11-10T13:00:00Z") });
    const late = sendingWindow(new Date("2026-11-11T02:00:00Z"), BOGOTA, { fromHour: 8, toHour: 20 }); // 9 p. m.
    expect(late.opensAt).toEqual(new Date("2026-11-11T13:00:00Z"));
  });

  it("calentamiento: el tope sube de a poco los primeros 7 días y no cambia a mitad del día", () => {
    expect(warmupDay(0)).toBe(1);
    expect(capToday(300, 0, false)).toBe(20);
    expect(capToday(300, 1, true)).toBe(20);
    expect(capToday(300, 1, false)).toBe(40);
    expect(capToday(300, 6, false)).toBe(250);
    expect(warmupDay(7)).toBeNull();
    expect(capToday(300, 7, false)).toBe(300);
    expect(capToday(100, 4, false)).toBe(100);
  });

  it("cuántos días tarda: el número más lento manda", () => {
    expect(estimateDays([{ count: 600, daysWithSends: 10 }, { count: 50, daysWithSends: 0 }], 300)).toBe(2);
    expect(estimateDays([{ count: 100, daysWithSends: 0 }], 300)).toBe(3);
    expect(estimateDays([], 300)).toBe(0);
  });

  it("el inicio del mes es el del negocio", () => {
    expect(startOfMonth(NOW, BOGOTA)).toEqual(new Date("2026-11-01T05:00:00Z"));
  });
});

describe("cada persona", () => {
  it("su nombre, sin huecos si no lo sabemos, y el pie para salir", () => {
    expect(personalize("Hola {first_name}, ¿te muestro?", { name: "Laura Gómez", phone: "57300" }, false)).toBe("Hola Laura, ¿te muestro?");
    expect(personalize("Hola {first_name} 👋", { name: null, phone: "57300" }, false)).toBe("Hola 👋");
    expect(personalize("Hola {first_name}!", { name: null, phone: "57300" }, false)).toBe("Hola!");
    expect(personalize("Hola {nombre}", { name: "Ana", phone: "57300" }, true)).toBe("Hola Ana\n\n_Para no recibir más mensajes, responde SALIR._");
  });

  it("reconoce cuando alguien pide no recibir más", () => {
    for (const text of ["SALIR", "Salir.", "stop", "No quiero más mensajes", "por favor no me escriban", "Sácame de la lista"]) expect(isOptOut(text)).toBe(true);
    for (const text of ["Quiero salir a comprar", "¿Cuánto vale?", "no", ""]) expect(isOptOut(text)).toBe(false);
  });
});

describe("versiones", () => {
  it("sin prueba A/B, cada uno una al azar", () => {
    let i = 0;
    const randoms = [0.1, 0.6, 0.9];
    expect(assignVariants(3, 3, null, () => randoms[i++]!)).toEqual([0, 1, 2]);
    expect(assignVariants(2, 1, null)).toEqual([0, 0]);
  });

  it("con prueba A/B, una parte se reparte y el resto espera al ganador", () => {
    expect(assignVariants(10, 2, { sharePercent: 20, decideAfterHours: 6 })).toEqual([0, 1, null, null, null, null, null, null, null, null]);
    expect(assignVariants(3, 3, { sharePercent: 10, decideAfterHours: 6 })).toEqual([0, 1, 2]);
  });

  it("gana la que más vendió por envío; empate: la plata, después las respuestas", () => {
    expect(pickWinner([{ variant: 0, sent: 100, bought: 3, revenue: 300, replied: 30 }, { variant: 1, sent: 50, bought: 2, revenue: 100, replied: 5 }])).toBe(1);
    expect(pickWinner([{ variant: 0, sent: 10, bought: 1, revenue: 100, replied: 1 }, { variant: 1, sent: 10, bought: 1, revenue: 200, replied: 0 }])).toBe(1);
    expect(pickWinner([{ variant: 0, sent: 10, bought: 0, revenue: 0, replied: 1 }, { variant: 1, sent: 10, bought: 0, revenue: 0, replied: 3 }])).toBe(1);
    expect(pickWinner([])).toBe(0);
  });

  it("barajar no pierde a nadie", () => {
    expect(shuffle([1, 2, 3, 4], () => 0.5).sort()).toEqual([1, 2, 3, 4]);
  });
});
