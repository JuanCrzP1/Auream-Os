import { describe, expect, it, vi } from "vitest";
import { businessValuesOf } from "../../contracts/BusinessDataContracts.js";
import { scheduleState, valueAt, type BusinessDataSchedule } from "../../contracts/BusinessDataTimeline.js";
import { BusinessDataServices } from "../../domains/business-data/application/BusinessDataServices.js";
import { removalOf, requireNewSchedule, requireScheduleChanges, type ScheduleContext } from "../../domains/business-data/domain/DatumSchedule.js";
import { datumChanges } from "../../domains/business-data/domain/datumChanges.js";
import { InMemoryBusinessDataRepository } from "../../infrastructure/persistence/memory/InMemoryBusinessData.js";
import { SqlBusinessValues } from "../../infrastructure/persistence/sql/SqlBusinessData.js";

// ---------------------------------------------------------------------------
// Datos del negocio en el tiempo: un cambio programado (el horario de
// Navidad) rige entre dos horas de la EMPRESA y vuelve solo al de siempre,
// en todo lo que lee `{g_…}`; y el historial dice quién cambió qué.
// ---------------------------------------------------------------------------

const TZ = "America/Bogota"; // UTC-5, sin horario de verano
const NOW = new Date("2026-11-13T15:00:00.000Z"); // 13 nov, 10:00 a. m. en Bogotá
const when = (date: string, time: string) => ({ date, time });
const navidad: BusinessDataSchedule = { id: "s1", value: "Abrimos el 26 desde las 8", startsAt: "2026-12-24T13:00:00.000Z", endsAt: "2026-12-26T13:00:00.000Z", note: "Navidad", createdBy: null, createdAt: NOW.toISOString() };
const context = (others: BusinessDataSchedule[] = [], now = NOW): ScheduleContext => ({ type: "text", baseValue: "Lunes a sábado, 8 a 6", timezone: TZ, now, others });

describe("el valor del momento", () => {
  const horario = { key: "g_horario", type: "text" as const, value: "Lunes a sábado, 8 a 6", schedules: [navidad] };

  it("rige desde «desde» (incluido) hasta «hasta» (sin incluir), y vuelve solo", () => {
    expect(valueAt(horario, new Date("2026-12-24T12:59:59.999Z"))).toBe("Lunes a sábado, 8 a 6");
    expect(valueAt(horario, new Date("2026-12-24T13:00:00.000Z"))).toBe("Abrimos el 26 desde las 8");
    expect(valueAt(horario, new Date("2026-12-26T12:59:59.999Z"))).toBe("Abrimos el 26 desde las 8");
    expect(valueAt(horario, new Date("2026-12-26T13:00:00.000Z"))).toBe("Lunes a sábado, 8 a 6");
    expect(scheduleState(navidad, NOW)).toBe("upcoming");
  });

  it("todo lo que lee {g_…} (motor, chat, difusiones) dice lo mismo, con su tipo", () => {
    const promo = { key: "g_promo", type: "boolean" as const, value: "false", schedules: [{ ...navidad, value: "true" }] };
    expect(businessValuesOf([horario, promo], new Date("2026-12-25T00:00:00.000Z"))).toEqual({ g_horario: "Abrimos el 26 desde las 8", g_promo: true });
    expect(businessValuesOf([horario, promo], NOW)).toEqual({ g_horario: "Lunes a sábado, 8 a 6", g_promo: false });
  });

  it("el motor guarda los datos 15 s pero decide el valor en cada lectura: entra justo a su hora", async () => {
    let now = Date.parse("2026-12-24T12:59:50.000Z");
    const list = vi.fn().mockResolvedValue([horario]);
    const reader = new SqlBusinessValues({ list }, 15_000, () => now);
    expect(await reader.values("t")).toEqual({ g_horario: "Lunes a sábado, 8 a 6" });
    now += 10_000; // 8:00:00 en Bogotá, sin volver a la base
    expect(await reader.values("t")).toEqual({ g_horario: "Abrimos el 26 desde las 8" });
    expect(list).toHaveBeenCalledTimes(1);
  });
});

describe("las reglas de un cambio programado", () => {
  it("las fechas son de la hora de la empresa (8:00 en Bogotá es 13:00 UTC)", () => {
    const shape = requireNewSchedule({ value: "Abrimos el 26 desde las 8", from: when("2026-12-24", "08:00"), until: when("2026-12-26", "08:00"), note: "  Navidad  " }, context());
    expect(shape).toEqual({ value: "Abrimos el 26 desde las 8", startsAt: new Date("2026-12-24T13:00:00.000Z"), endsAt: new Date("2026-12-26T13:00:00.000Z"), note: "Navidad" });
  });

  it("«desde» en el pasado empieza ya; «hasta» va después y a lo sumo un año adelante", () => {
    expect(requireNewSchedule({ value: "Cerrado", from: when("2026-11-01", "08:00"), until: when("2026-11-14", "08:00") }, context()).startsAt).toEqual(NOW);
    expect(() => requireNewSchedule({ value: "Cerrado", from: when("2026-12-26", "08:00"), until: when("2026-12-24", "08:00") }, context())).toThrow("«Hasta» va después de «desde».");
    expect(() => requireNewSchedule({ value: "Cerrado", from: when("2026-11-01", "08:00"), until: when("2026-11-12", "08:00") }, context())).toThrow("«Hasta» ya pasó");
    expect(() => requireNewSchedule({ value: "Cerrado", from: when("2026-12-24", "08:00"), until: when("2027-12-24", "08:00") }, context())).toThrow("hasta un año adelante");
    expect(() => requireNewSchedule({ value: "Cerrado", from: when("2026-02-30", "08:00"), until: when("2026-12-24", "08:00") }, context())).toThrow("Elige la fecha «desde».");
    expect(() => requireNewSchedule({ value: "Cerrado", from: when("2026-12-24", "25:00"), until: when("2026-12-25", "08:00") }, context())).toThrow("Elige la hora «desde».");
  });

  it("el valor es del tipo del dato y no es el mismo de siempre", () => {
    expect(() => requireNewSchedule({ value: "Lunes a sábado, 8 a 6", from: when("2026-12-24", "08:00"), until: when("2026-12-26", "08:00") }, context())).toThrow("Es el mismo valor de siempre");
    const cupos = { ...context(), type: "number" as const, baseValue: "12" };
    expect(() => requireNewSchedule({ value: "muchos", from: when("2026-12-24", "08:00"), until: when("2026-12-26", "08:00") }, cupos)).toThrow("solo con números");
    expect(requireNewSchedule({ value: "1.200", from: when("2026-12-24", "08:00"), until: when("2026-12-26", "08:00") }, cupos).value).toBe("1200");
  });

  it("dos cambios del mismo dato no se cruzan (pegados sí), y hay hasta 10 a la vez", () => {
    expect(() => requireNewSchedule({ value: "Otro", from: when("2026-12-25", "08:00"), until: when("2026-12-27", "08:00") }, context([navidad]))).toThrow("Se cruza con «Navidad» (24 dic, 8:00");
    expect(requireNewSchedule({ value: "Otro", from: when("2026-12-26", "08:00"), until: when("2026-12-27", "08:00") }, context([navidad])).startsAt).toEqual(new Date("2026-12-26T13:00:00.000Z"));
    const many = Array.from({ length: 10 }, (_, i) => ({ ...navidad, id: `s${i}` }));
    expect(() => requireNewSchedule({ value: "Otro", from: when("2027-01-02", "08:00"), until: when("2027-01-03", "08:00") }, context(many))).toThrow("hasta 10 cambios programados");
  });

  it("uno que ya rige se edita sin mover «desde»; uno terminado no se toca; quitar uno activo lo termina", () => {
    const during = new Date("2026-12-25T00:00:00.000Z");
    const edited = requireScheduleChanges(navidad, { from: when("2026-12-20", "08:00"), until: when("2026-12-27", "08:00") }, context([], during));
    expect([edited.startsAt.toISOString(), edited.endsAt.toISOString(), edited.value]).toEqual([navidad.startsAt, "2026-12-27T13:00:00.000Z", navidad.value]);
    expect(() => requireScheduleChanges(navidad, { note: "x" }, context([], new Date("2026-12-27T00:00:00.000Z")))).toThrow("Ese cambio ya terminó");
    expect([removalOf(navidad, NOW), removalOf(navidad, during)]).toEqual(["unscheduled", "ended"]);
  });
});

describe("el historial", () => {
  const ID = "11111111-1111-4111-8111-111111111111";
  const setup = () => {
    let now = NOW;
    const repository = new InMemoryBusinessDataRepository(() => now);
    const cache = { forget: vi.fn() };
    let n = 0;
    const services = new BusinessDataServices(repository, { flows: async () => [], broadcasts: async () => [], quickReplies: async () => [] }, cache, {
      newId: () => (n++ === 0 ? ID : `22222222-2222-4222-8222-00000000000${n}`),
      now: () => now,
      timeZoneOf: async () => TZ
    });
    return { services, cache, at: (iso: string) => (now = new Date(iso)) };
  };

  it("anota una línea por cada cosa que cambió; guardar sin cambiar nada no anota", () => {
    expect(datumChanges({ key: "g_h", label: "Horario", type: "text", value: "8 a 6", description: "" }, { key: "g_h", label: "Horario de atención", type: "text", value: "9 a 7", description: "" })).toEqual([
      { kind: "label", before: "Horario", after: "Horario de atención" },
      { kind: "value", before: "8 a 6", after: "9 a 7" }
    ]);
  });

  it("crear, cambiar, programar, editar y quitar dejan su línea; el motor ve cada cambio", async () => {
    const { services, cache } = setup();
    await services.create("t", { label: "Horario", type: "text", value: "8 a 6" }, "camilo");
    await services.update("t", ID, { value: "9 a 7" }, "camilo");
    await services.update("t", ID, { value: "9 a 7" }, "camilo");
    const scheduled = await services.timeline.schedule("t", ID, { value: "Cerrado", from: when("2026-12-24", "08:00"), until: when("2026-12-26", "08:00"), note: "Navidad" }, "ana");
    const sid = scheduled.schedules[0]!.id;
    await services.timeline.reschedule("t", ID, sid, { until: when("2026-12-27", "08:00") }, "ana");
    await services.timeline.unschedule("t", ID, sid, "ana");
    const { changes } = await services.timeline.history("t", ID);
    expect(changes.map((change) => [change.kind, change.actorName])).toEqual([
      ["unscheduled", "ana"],
      ["rescheduled", "ana"],
      ["scheduled", "ana"],
      ["value", "camilo"],
      ["created", "camilo"]
    ]);
    expect(changes[3]).toMatchObject({ before: "8 a 6", after: "9 a 7", valueType: "text" });
    expect(cache.forget).toHaveBeenCalledTimes(5);
  });

  it("terminar ya uno activo devuelve el valor de siempre en ese momento", async () => {
    const { services, at } = setup();
    await services.create("t", { label: "Horario", type: "text", value: "8 a 6" }, "camilo");
    const sid = (await services.timeline.schedule("t", ID, { value: "Cerrado", from: when("2026-12-24", "08:00"), until: when("2026-12-26", "08:00") }, "ana")).schedules[0]!.id;
    at("2026-12-25T00:00:00.000Z");
    expect(await services.values("t")).toEqual({ values: { g_horario: "Cerrado" } });
    expect((await services.timeline.unschedule("t", ID, sid, "ana")).schedules).toEqual([]);
    expect(await services.values("t")).toEqual({ values: { g_horario: "8 a 6" } });
    expect((await services.timeline.history("t", ID)).changes[0]).toMatchObject({ kind: "ended", schedule: { value: "Cerrado", endsAt: "2026-12-25T00:00:00.000Z" } });
  });

  it("con cambios programados no se cambia el tipo (su valor es del tipo de ahora)", async () => {
    const { services } = setup();
    await services.create("t", { label: "Cupos", type: "text", value: "12" }, "camilo");
    await services.timeline.schedule("t", ID, { value: "20", from: when("2026-12-24", "08:00"), until: when("2026-12-26", "08:00") }, "ana");
    await expect(services.update("t", ID, { type: "number" }, "camilo")).rejects.toThrow("Quita sus cambios programados antes de cambiarle el tipo");
  });
});
