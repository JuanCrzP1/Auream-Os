import { describe, expect, it } from "vitest";
import { instantOf, presets, wallOf, whenLabel, whenProblem, zoneLabel } from "../../src/features/conversations/components/scheduled/scheduleModel";

// ---------------------------------------------------------------------------
// Las horas de los programados en la zona del NEGOCIO: los atajos, la
// etiqueta de cuándo sale y la misma revisión que hace el servidor.
// ---------------------------------------------------------------------------

const ZONE = "America/Bogota";
const THURSDAY_3PM = new Date("2026-11-12T20:00:00.000Z"); // jueves 12, 3:00 p. m. en Bogotá

describe("horas de los mensajes programados", () => {
  it("el reloj del negocio y su instante, ida y vuelta", () => {
    expect(wallOf(THURSDAY_3PM, ZONE)).toEqual({ date: "2026-11-12", time: "15:00", weekday: 4 });
    expect(instantOf({ date: "2026-11-13", time: "09:00" }, ZONE).toISOString()).toBe("2026-11-13T14:00:00.000Z");
    expect(instantOf({ date: "2026-11-13", time: "09:00" }, "Europe/Madrid").toISOString()).toBe("2026-11-13T08:00:00.000Z");
  });

  it("atajos: en 1 hora redondeado a 5 minutos, mañana 9:00 y 3:00 p. m., y el lunes; el domingo no repite «el lunes»", () => {
    expect(presets(new Date("2026-11-12T20:02:00.000Z"), ZONE).map((preset) => [preset.id, preset.when.date, preset.when.time])).toEqual([
      ["hour", "2026-11-12", "16:05"],
      ["morning", "2026-11-13", "09:00"],
      ["afternoon", "2026-11-13", "15:00"],
      ["monday", "2026-11-16", "09:00"]
    ]);
    const sunday = new Date("2026-11-15T20:00:00.000Z");
    expect(presets(sunday, ZONE).map((preset) => preset.id)).toEqual(["hour", "morning", "afternoon"]);
  });

  it("«hoy», «mañana» o el día con la fecha, en 12 horas", () => {
    expect(whenLabel(new Date("2026-11-12T22:30:00.000Z"), ZONE, THURSDAY_3PM)).toBe("hoy, 5:30 p. m.");
    expect(whenLabel(new Date("2026-11-13T14:00:00.000Z"), ZONE, THURSDAY_3PM)).toBe("mañana, 9:00 a. m.");
    expect(whenLabel(new Date("2026-11-16T14:00:00.000Z"), ZONE, THURSDAY_3PM)).toMatch(/^lun 16 nov, 9:00 a\. m\.$/);
    expect(whenLabel(new Date("2027-01-04T14:00:00.000Z"), ZONE, THURSDAY_3PM)).toContain("2027");
  });

  it("revisa como el servidor: fecha y hora válidas, al menos un minuto y hasta 90 días", () => {
    expect(whenProblem({ date: "2026-11-13", time: "09:00" }, ZONE, THURSDAY_3PM)).toBeNull();
    expect(whenProblem({ date: "2026-11-12", time: "15:00" }, ZONE, THURSDAY_3PM)).toMatch(/al menos un minuto/);
    expect(whenProblem({ date: "2027-03-01", time: "09:00" }, ZONE, THURSDAY_3PM)).toMatch(/hasta 90 días/);
    expect(whenProblem({ date: "", time: "09:00" }, ZONE, THURSDAY_3PM)).toBe("Elige una fecha válida.");
    expect(whenProblem({ date: "2026-11-13", time: "" }, ZONE, THURSDAY_3PM)).toBe("Elige una hora válida.");
  });

  it("el nombre de la zona en español («Hora de Colombia»)", () => {
    expect(zoneLabel(ZONE)).toBe("Hora de Colombia");
    expect(zoneLabel("Zona/Inventada")).toBe("Hora de Inventada");
  });
});
