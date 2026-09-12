import { describe, expect, it } from "vitest";
import {
  EMPTY_SCHEDULE,
  INTERVAL_DEFAULT_CONFIG,
  INTERVAL_MAX_WAIT_MS,
  WEEKDAYS,
  esFechaValida,
  esHoraValida,
  intervalWaitMs,
  readIntervalConfig
} from "@contracts/IntervalConfig";
import {
  CANTIDAD_INVALIDA,
  DIA_SIN_FRANJAS,
  ESPERA_DEMASIADO_LARGA,
  FECHA_INCOMPLETA,
  FECHA_INVALIDA,
  FRANJA_INVERTIDA,
  HORA_INVALIDA,
  MODO_DESCONOCIDO,
  SIN_DIAS_ACTIVOS,
  UNIDAD_INVALIDA,
  validateInterval
} from "@features/automations/builder/tools/interval/validateInterval";
import {
  describirIntervalo,
  explicarIntervalo,
  summarizeInterval
} from "@features/automations/builder/tools/interval/summarizeInterval";

// ---------------------------------------------------------------------------
// El Programador sin pantalla de por medio: forma, lectura, validación y
// resumen.
//
// Todo lo de aquí es puro. Lo que se prueba es el COMPORTAMIENTO —qué sale de
// qué entra— y no el texto de ningún control, que vive en las pruebas de
// componente.
//
// EL MODELO QUE SE PRUEBA. Un Programador tiene UN MOMENTO PRINCIPAL —esperar
// un rato O una fecha concreta, nunca los dos— y, encima, un HORARIO OPCIONAL
// que lo acota. Esa asimetría es la regla de negocio, y buena parte de este
// archivo existe para fijarla: las combinaciones que el dominio prohíbe no se
// rechazan con un `if`, se hacen IMPOSIBLES DE ESCRIBIR, y eso también se
// comprueba.
// ---------------------------------------------------------------------------

/** Una configuración con el momento principal explícito. */
const con = (trigger: string, resto: Record<string, unknown> = {}) => ({ trigger, ...resto });

/**
 * Una configuración de la PRIMERA VERSIÓN, con `mode` y tres modos iguales.
 *
 * Existe porque hay nodos guardados así y ninguno se va a migrar a mano: lo que
 * los sigue entendiendo es el lector, y eso hay que probarlo con la forma real
 * que tienen en disco, no con una aproximación.
 */
const heredado = (mode: string, resto: Record<string, unknown> = {}) => ({ mode, ...resto });

const horario = (dias: Record<string, { enabled: boolean; ranges: unknown[] }>) => ({
  ...Object.fromEntries(WEEKDAYS.map((d) => [d, { enabled: false, ranges: [] }])),
  ...dias
});

const UNA_FRANJA = [{ start: "09:00", end: "18:00" }];

const LUNES_LABORAL = horario({ monday: { enabled: true, ranges: UNA_FRANJA } });

describe("configuración por defecto", () => {
  it("nace esperando un rato, sin horario, y lista para guardar", () => {
    expect(INTERVAL_DEFAULT_CONFIG.trigger).toBe("interval");
    expect(INTERVAL_DEFAULT_CONFIG.wait).toEqual({ amount: 5, unit: "minutes" });
    expect(INTERVAL_DEFAULT_CONFIG.scheduleEnabled).toBe(false);
    expect(validateInterval({}, { ...INTERVAL_DEFAULT_CONFIG })).toEqual({
      valido: true,
      motivo: null
    });
  });

  it("no inventa una fecha ni enciende ningún día", () => {
    expect(INTERVAL_DEFAULT_CONFIG.moment).toBeNull();
    for (const dia of WEEKDAYS) {
      expect(EMPTY_SCHEDULE[dia]).toEqual({ enabled: false, ranges: [] });
    }
  });
});

// ---------------------------------------------------------------------------
// LA MATRIZ DE VALIDEZ, entera.
//
// Siete combinaciones posibles de «después», «fecha» y «horario». Cuatro son
// válidas y tres no, pero NO SE RECHAZAN IGUAL: dos de las tres inválidas ni
// siquiera se pueden representar, y ese es justamente el punto. Un modelo que
// permite escribir un estado prohibido y luego lo rechaza con una regla es un
// modelo que ya falló — la regla se puede olvidar, la imposibilidad no.
// ---------------------------------------------------------------------------
describe("matriz de validez", () => {
  it("1 · solo «después» → VÁLIDO", () => {
    expect(validateInterval({}, con("interval", { wait: { amount: 5, unit: "minutes" } })).valido).toBe(true);
  });

  it("2 · solo «fecha» → VÁLIDO", () => {
    expect(validateInterval({}, con("date", { moment: { date: "2026-09-25", time: "14:30" } })).valido).toBe(true);
  });

  it("3 · solo «horario» → NO EXISTE: siempre hay un momento principal detrás", () => {
    // No hay forma de pedir «solo dentro del horario» y nada más: el horario es
    // una restricción, y una restricción sin nada que restringir no dice cuándo
    // continuar. Encender el horario sobre una configuración recién nacida deja
    // la espera de siempre gobernando.
    const leida = readIntervalConfig({ scheduleEnabled: true, schedule: LUNES_LABORAL });

    expect(leida.trigger).toBe("interval");
    expect(leida.wait).toEqual({ amount: 5, unit: "minutes" });
  });

  it("4 · «después» + «fecha» → NO EXISTE: `trigger` es uno solo", () => {
    // Se guardan las dos cosas a la vez —para que cambiar de opinión no borre
    // trabajo— pero solo una GOBIERNA, y la elige `trigger`. Aquí la fecha está
    // escrita y aun así no cuenta para nada.
    const config = con("interval", {
      wait: { amount: 5, unit: "minutes" },
      moment: { date: "2026-02-31", time: "99:99" }
    });

    expect(readIntervalConfig(config).trigger).toBe("interval");
    // Una fecha imposible guardada al lado no impide guardar: no gobierna.
    expect(validateInterval({}, config).valido).toBe(true);
    expect(intervalWaitMs(readIntervalConfig(config))).toBe(300_000);
  });

  it("5 · «después» + «horario» → VÁLIDO, y es el caso corriente", () => {
    const validez = validateInterval({}, con("interval", {
      wait: { amount: 5, unit: "minutes" },
      scheduleEnabled: true,
      schedule: LUNES_LABORAL
    }));

    expect(validez).toEqual({ valido: true, motivo: null });
  });

  it("6 · «fecha» + «horario» → VÁLIDO", () => {
    const validez = validateInterval({}, con("date", {
      moment: { date: "2026-09-25", time: "14:30" },
      scheduleEnabled: true,
      schedule: LUNES_LABORAL
    }));

    expect(validez).toEqual({ valido: true, motivo: null });
  });

  it("7 · los tres a la vez → NO EXISTE, por la misma razón que el 4", () => {
    const leida = readIntervalConfig({
      trigger: "date",
      wait: { amount: 5, unit: "minutes" },
      moment: { date: "2026-09-25", time: "14:30" },
      scheduleEnabled: true,
      schedule: LUNES_LABORAL
    });

    // Hay espera guardada, pero el momento principal es la fecha: solo uno
    // gobierna, y el horario se suma a ese sin convertirse en un tercero.
    expect(leida.trigger).toBe("date");
    expect(intervalWaitMs(leida)).toBeNull();
    expect(leida.scheduleEnabled).toBe(true);
  });
});

describe("el horario es OPCIONAL, y eso se nota en qué bloquea", () => {
  it("apagado, un horario roto no impide guardar", () => {
    const validez = validateInterval({}, con("interval", {
      wait: { amount: 3, unit: "minutes" },
      scheduleEnabled: false,
      schedule: horario({ monday: { enabled: true, ranges: [] } })
    }));

    expect(validez.valido).toBe(true);
  });

  it("encendido, el mismo horario roto SÍ lo impide", () => {
    // La misma configuración salvo el interruptor. Es la prueba de que lo que
    // decide no es que el horario esté escrito, sino que gobierne.
    const validez = validateInterval({}, con("interval", {
      wait: { amount: 3, unit: "minutes" },
      scheduleEnabled: true,
      schedule: horario({ monday: { enabled: true, ranges: [] } })
    }));

    expect(validez.motivo).toBe(DIA_SIN_FRANJAS);
  });

  it("encendido y vacío tampoco vale: no dejaría continuar nunca", () => {
    expect(validateInterval({}, con("interval", { scheduleEnabled: true })).motivo).toBe(SIN_DIAS_ACTIVOS);
  });

  it("una fecha a medias bloquea aunque el horario esté perfecto", () => {
    // El momento principal manda: sin él no hay nada que acotar.
    const validez = validateInterval({}, con("date", {
      moment: { date: "2026-09-25", time: "" },
      scheduleEnabled: true,
      schedule: LUNES_LABORAL
    }));

    expect(validez.motivo).toBe(FECHA_INCOMPLETA);
  });
});

describe("nodos guardados con la versión anterior", () => {
  it("«interval» y «date» se traducen a su momento principal", () => {
    expect(readIntervalConfig(heredado("interval")).trigger).toBe("interval");
    expect(readIntervalConfig(heredado("date")).trigger).toBe("date");
    expect(readIntervalConfig(heredado("interval")).scheduleEnabled).toBe(false);
  });

  it("«schedule» era un horario ENCIMA de la espera, y así se lee", () => {
    // Fue el error del modelo viejo: el horario nunca fue un momento principal.
    // Un nodo guardado en ese modo no pierde su horario —se enciende— y recupera
    // el momento que le faltaba, que es la espera por defecto.
    const leida = readIntervalConfig(heredado("schedule", { schedule: LUNES_LABORAL }));

    expect(leida.trigger).toBe("interval");
    expect(leida.scheduleEnabled).toBe(true);
    expect(leida.schedule.monday.ranges).toEqual(UNA_FRANJA);
  });

  it("un nodo heredado se puede guardar tal cual, sin tocarlo", () => {
    expect(validateInterval({}, heredado("schedule", { schedule: LUNES_LABORAL })).valido).toBe(true);
  });

  it("el `trigger` nuevo manda sobre el `mode` viejo si están los dos", () => {
    expect(readIntervalConfig({ trigger: "date", mode: "interval" }).trigger).toBe("date");
  });
});

describe("lectura defensiva de lo guardado", () => {
  it("una configuración vacía se lee como la de un nodo nuevo", () => {
    expect(readIntervalConfig({})).toEqual(INTERVAL_DEFAULT_CONFIG);
  });

  it("un momento principal desconocido cae al del contrato en vez de romper", () => {
    expect(readIntervalConfig({ trigger: "telepatia" }).trigger).toBe("interval");
    expect(readIntervalConfig(heredado("telepatia")).trigger).toBe("interval");
  });

  it("un interruptor de horario corrupto se lee como apagado", () => {
    expect(readIntervalConfig({ scheduleEnabled: "sí" }).scheduleEnabled).toBe(false);
    expect(readIntervalConfig({ scheduleEnabled: 1 }).scheduleEnabled).toBe(false);
  });

  it("una espera corrupta cae al default, campo a campo", () => {
    const leida = readIntervalConfig({ wait: { amount: -3, unit: "siglos" } });

    expect(leida.wait).toEqual({ amount: 5, unit: "minutes" });
  });

  it("sin fecha guardada no se inventa ninguna", () => {
    expect(readIntervalConfig({}).moment).toBeNull();
    expect(readIntervalConfig({ moment: "mañana" }).moment).toBeNull();
    expect(readIntervalConfig({ moment: { date: "", time: "" } }).moment).toBeNull();
  });

  it("CONSERVA una fecha a medio escribir para poder terminarla", () => {
    // Esto fue un fallo real: el lector descartaba el momento incompleto, así
    // que escribir el día lo borraba antes de poder escribir la hora y el par
    // era imposible de completar. El lector dice qué se PINTA; que eso no se
    // pueda guardar lo dice la validación.
    expect(readIntervalConfig({ moment: { date: "2026-09-25" } }).moment).toEqual({
      date: "2026-09-25",
      time: ""
    });
    expect(readIntervalConfig({ moment: { time: "14:30" } }).moment).toEqual({
      date: "",
      time: "14:30"
    });
  });

  it("una fecha imposible se conserva para que se pueda corregir, pero no se guarda", () => {
    expect(readIntervalConfig({ moment: { date: "2026-02-31", time: "14:30" } }).moment).toEqual({
      date: "2026-02-31",
      time: "14:30"
    });
    expect(
      validateInterval({}, con("date", { moment: { date: "2026-02-31", time: "14:30" } })).valido
    ).toBe(false);
  });

  it("conserva una fecha y hora bien formadas", () => {
    expect(readIntervalConfig({ moment: { date: "2026-09-25", time: "14:30" } }).moment).toEqual({
      date: "2026-09-25",
      time: "14:30"
    });
  });

  it("siempre devuelve los siete días, aunque el guardado traiga menos", () => {
    const leida = readIntervalConfig({ schedule: { monday: { enabled: true, ranges: [] } } });

    expect(Object.keys(leida.schedule).sort()).toEqual([...WEEKDAYS].sort());
    expect(leida.schedule.sunday).toEqual({ enabled: false, ranges: [] });
  });

  it("descarta las franjas ilegibles y conserva las buenas", () => {
    const leida = readIntervalConfig({
      schedule: {
        monday: {
          enabled: true,
          ranges: [{ start: "09:00", end: "12:00" }, null, { start: "25:00", end: "30:00" }]
        }
      }
    });

    expect(leida.schedule.monday.ranges).toEqual([{ start: "09:00", end: "12:00" }]);
  });

  it("no muta lo que recibe", () => {
    const original = { trigger: "date", moment: { date: "2026-09-25", time: "14:30" } };
    const copia = structuredClone(original);

    readIntervalConfig(original);

    expect(original).toEqual(copia);
  });
});

describe("aritmética de la espera", () => {
  it("convierte cada unidad a milisegundos", () => {
    const ms = (amount: number, unit: string) =>
      intervalWaitMs(readIntervalConfig(con("interval", { wait: { amount, unit } })));

    expect(ms(30, "seconds")).toBe(30_000);
    expect(ms(5, "minutes")).toBe(300_000);
    expect(ms(2, "hours")).toBe(7_200_000);
    expect(ms(1, "days")).toBe(86_400_000);
  });

  it("no significa nada cuando el momento principal es una fecha", () => {
    expect(intervalWaitMs(readIntervalConfig(con("date")))).toBeNull();
  });

  it("el horario no la anula: una espera acotada sigue siendo una espera", () => {
    // En el modelo viejo «horario» era un modo y cancelaba la espera. Ahora se
    // suma a ella, así que el motor sigue teniendo cuánto esperar.
    const leida = readIntervalConfig(con("interval", {
      wait: { amount: 5, unit: "minutes" },
      scheduleEnabled: true,
      schedule: LUNES_LABORAL
    }));

    expect(intervalWaitMs(leida)).toBe(300_000);
  });

  it("el tope son 31 días, se escriba en la unidad que se escriba", () => {
    expect(INTERVAL_MAX_WAIT_MS).toBe(31 * 86_400_000);
    // 31 días y 44.640 minutos son la misma espera: o caben las dos o ninguna.
    expect(validateInterval({}, con("interval", { wait: { amount: 31, unit: "days" } })).valido).toBe(true);
    expect(validateInterval({}, con("interval", { wait: { amount: 44_640, unit: "minutes" } })).valido).toBe(true);
    expect(validateInterval({}, con("interval", { wait: { amount: 44_641, unit: "minutes" } })).motivo).toBe(ESPERA_DEMASIADO_LARGA);
  });
});

describe("validación — la espera", () => {
  const espera = (wait: unknown) => validateInterval({}, con("interval", { wait }));

  it("acepta una espera entera y positiva", () => {
    expect(espera({ amount: 3, unit: "minutes" }).valido).toBe(true);
  });

  it("rechaza cero, negativos y decimales", () => {
    expect(espera({ amount: 0, unit: "minutes" }).motivo).toBe(CANTIDAD_INVALIDA);
    expect(espera({ amount: -5, unit: "minutes" }).motivo).toBe(CANTIDAD_INVALIDA);
    expect(espera({ amount: 2.5, unit: "hours" }).motivo).toBe(CANTIDAD_INVALIDA);
  });

  it("rechaza una cantidad que no es un número", () => {
    expect(espera({ amount: "tres", unit: "minutes" }).motivo).toBe(CANTIDAD_INVALIDA);
    expect(espera({ amount: Number.NaN, unit: "minutes" }).motivo).toBe(CANTIDAD_INVALIDA);
  });

  it("rechaza una unidad que la herramienta no ofrece", () => {
    expect(espera({ amount: 3, unit: "semanas" }).motivo).toBe(UNIDAD_INVALIDA);
  });

  it("rechaza pasarse del tope", () => {
    expect(espera({ amount: 32, unit: "days" }).motivo).toBe(ESPERA_DEMASIADO_LARGA);
  });

  it("un momento principal presente pero desconocido no se guarda encima", () => {
    expect(validateInterval({}, { trigger: "telepatia" }).motivo).toBe(MODO_DESCONOCIDO);
  });

  it("un `mode` heredado NO se rechaza: se traduce", () => {
    // Rechazarlo dejaría sin poder guardar a todo nodo creado antes.
    expect(validateInterval({}, heredado("schedule", { schedule: LUNES_LABORAL })).valido).toBe(true);
  });
});

describe("validación — la fecha", () => {
  const fecha = (moment: unknown) => validateInterval({}, con("date", { moment }));

  it("acepta una fecha y hora completas", () => {
    expect(fecha({ date: "2026-09-25", time: "14:30" }).valido).toBe(true);
  });

  it("rechaza no haber elegido nada", () => {
    expect(fecha(undefined).motivo).toBe(FECHA_INCOMPLETA);
    expect(fecha(null).motivo).toBe(FECHA_INCOMPLETA);
  });

  it("rechaza media configuración: día sin hora, u hora sin día", () => {
    expect(fecha({ date: "2026-09-25", time: "" }).motivo).toBe(FECHA_INCOMPLETA);
    expect(fecha({ date: "", time: "14:30" }).motivo).toBe(FECHA_INCOMPLETA);
  });

  it("rechaza un día que no existe en el calendario", () => {
    expect(fecha({ date: "2026-02-31", time: "14:30" }).motivo).toBe(FECHA_INVALIDA);
    expect(fecha({ date: "2026-13-01", time: "14:30" }).motivo).toBe(FECHA_INVALIDA);
  });

  it("acepta el 29 de febrero solo en año bisiesto", () => {
    expect(esFechaValida("2028-02-29")).toBe(true);
    expect(esFechaValida("2026-02-29")).toBe(false);
  });

  it("rechaza una hora imposible", () => {
    expect(fecha({ date: "2026-09-25", time: "25:00" }).motivo).toBe(HORA_INVALIDA);
    expect(esHoraValida("23:59")).toBe(true);
    expect(esHoraValida("24:00")).toBe(false);
  });

  it("acepta cualquier hora del día, incluidas las dos puntas", () => {
    // El campo de hora del navegador produce las 24; ninguna se puede rechazar
    // aquí sin que el usuario escriba algo que la herramienta no acepta.
    for (const time of ["00:00", "01:05", "12:30", "14:45", "23:59"]) {
      expect(fecha({ date: "2026-09-12", time }).valido).toBe(true);
    }
  });
});

describe("validación — el horario", () => {
  const conHorario = (dias: Parameters<typeof horario>[0]) =>
    validateInterval({}, con("interval", { scheduleEnabled: true, schedule: horario(dias) }));

  it("acepta un día activo con una franja válida", () => {
    expect(conHorario({ monday: { enabled: true, ranges: UNA_FRANJA } }).valido).toBe(true);
  });

  it("rechaza no tener ningún día activo", () => {
    expect(conHorario({}).motivo).toBe(SIN_DIAS_ACTIVOS);
  });

  it("rechaza un día activo sin franjas", () => {
    expect(conHorario({ monday: { enabled: true, ranges: [] } }).motivo).toBe(DIA_SIN_FRANJAS);
  });

  it("rechaza que el fin no vaya después del inicio", () => {
    expect(conHorario({ monday: { enabled: true, ranges: [{ start: "18:00", end: "09:00" }] } }).motivo).toBe(FRANJA_INVERTIDA);
    expect(conHorario({ monday: { enabled: true, ranges: [{ start: "09:00", end: "09:00" }] } }).motivo).toBe(FRANJA_INVERTIDA);
  });

  it("rechaza horas corruptas dentro de una franja", () => {
    expect(conHorario({ monday: { enabled: true, ranges: [{ start: "9", end: "18" }] } }).motivo).toBe(HORA_INVALIDA);
    expect(conHorario({ monday: { enabled: true, ranges: [null] } }).motivo).toBe(HORA_INVALIDA);
  });

  it("un día APAGADO con franjas rotas no impide guardar: no gobierna nada", () => {
    expect(
      conHorario({
        monday: { enabled: true, ranges: UNA_FRANJA },
        sunday: { enabled: false, ranges: [{ start: "99:99", end: "00:00" }] }
      }).valido
    ).toBe(true);
  });
});

describe("nada se estorba: todo convive en la configuración", () => {
  it("cambiar de momento principal conserva lo configurado en el otro", () => {
    const guardado = {
      trigger: "date",
      wait: { amount: 12, unit: "hours" },
      moment: { date: "2026-09-25", time: "14:30" },
      scheduleEnabled: true,
      schedule: horario({ friday: { enabled: true, ranges: [{ start: "10:00", end: "11:00" }] } })
    };

    const leida = readIntervalConfig({ ...guardado, trigger: "interval" });

    expect(leida.wait).toEqual({ amount: 12, unit: "hours" });
    expect(leida.moment).toEqual({ date: "2026-09-25", time: "14:30" });
    expect(leida.schedule.friday.ranges).toHaveLength(1);
    expect(leida.scheduleEnabled).toBe(true);
  });

  it("apagar el horario no borra sus días", () => {
    const leida = readIntervalConfig({ scheduleEnabled: false, schedule: LUNES_LABORAL });

    expect(leida.schedule.monday.ranges).toEqual(UNA_FRANJA);
  });
});

describe("resumen", () => {
  // LAS HORAS SE DICEN EN DOCE, en todas partes donde hay alguien leyendo. El
  // disco sigue guardando veinticuatro; lo que no puede pasar es que el editor
  // diga «02:45 p.m.» y el nodo del lienzo, al lado, diga «14:45».
  const resumen = (config: Record<string, unknown>) => summarizeInterval({}, config);

  it("la espera: singular y plural, sin «1 minutos»", () => {
    expect(resumen(con("interval", { wait: { amount: 3, unit: "minutes" } }))).toBe("Esperar 3 minutos");
    expect(resumen(con("interval", { wait: { amount: 1, unit: "hours" } }))).toBe("Esperar 1 hora");
    expect(resumen(con("interval", { wait: { amount: 2, unit: "days" } }))).toBe("Esperar 2 días");
  });

  it("la fecha: día y hora legibles", () => {
    expect(resumen(con("date", { moment: { date: "2026-09-25", time: "14:30" } }))).toBe("25 sep 2026 · 02:30 p.m.");
  });

  it("la fecha sin elegir: lo dice, no inventa una", () => {
    expect(resumen(con("date"))).toBe("Sin fecha configurada");
  });

  it("el horario se SUMA al momento, no lo sustituye", () => {
    expect(resumen(con("interval", {
      wait: { amount: 5, unit: "minutes" },
      scheduleEnabled: true,
      schedule: LUNES_LABORAL
    }))).toBe("Esperar 5 minutos + horario permitido");

    expect(resumen(con("date", {
      moment: { date: "2026-09-25", time: "14:30" },
      scheduleEnabled: true,
      schedule: LUNES_LABORAL
    }))).toBe("25 sep 2026 · 02:30 p.m. + horario permitido");
  });

  it("un horario apagado no se menciona aunque tenga días guardados", () => {
    expect(resumen(con("interval", {
      wait: { amount: 5, unit: "minutes" },
      scheduleEnabled: false,
      schedule: LUNES_LABORAL
    }))).toBe("Esperar 5 minutos");
  });

  it("la frase larga del editor sale de la misma configuración", () => {
    const config = readIntervalConfig(con("interval", { wait: { amount: 3, unit: "minutes" } }));

    expect(explicarIntervalo(config)).toBe(
      "La conversación continuará 3 minutos después de llegar a este bloque."
    );
    expect(describirIntervalo(config)).toBe("Esperar 3 minutos");
  });

  it("la frase larga cuenta las dos cosas cuando hay dos", () => {
    const franja = [{ start: "09:00", end: "18:00" }];
    const config = readIntervalConfig(con("interval", {
      wait: { amount: 3, unit: "minutes" },
      scheduleEnabled: true,
      schedule: horario({
        monday: { enabled: true, ranges: franja },
        tuesday: { enabled: true, ranges: franja },
        wednesday: { enabled: true, ranges: franja },
        thursday: { enabled: true, ranges: franja },
        friday: { enabled: true, ranges: franja }
      })
    }));

    expect(explicarIntervalo(config)).toBe(
      "La conversación continuará 3 minutos después de llegar a este bloque, " +
        "y solo de lunes a viernes, entre 09:00 a.m.–06:00 p.m."
    );
  });

  it("agrupa los días consecutivos y enumera los sueltos", () => {
    const franja = [{ start: "09:00", end: "18:00" }];
    const conDias = (dias: Parameters<typeof horario>[0]) =>
      explicarIntervalo(readIntervalConfig(con("interval", {
        scheduleEnabled: true,
        schedule: horario(dias)
      })));

    expect(conDias({
      monday: { enabled: true, ranges: franja },
      wednesday: { enabled: true, ranges: franja }
    })).toBe(
      "La conversación continuará 5 minutos después de llegar a este bloque, " +
        "y solo de lunes y miércoles, entre 09:00 a.m.–06:00 p.m."
    );
  });

  it("con franjas distintas por día no miente con una sola", () => {
    const config = readIntervalConfig(con("interval", {
      scheduleEnabled: true,
      schedule: horario({
        monday: { enabled: true, ranges: [{ start: "09:00", end: "12:00" }] },
        tuesday: { enabled: true, ranges: [{ start: "14:00", end: "18:00" }] }
      })
    }));

    expect(explicarIntervalo(config)).toBe(
      "La conversación continuará 5 minutos después de llegar a este bloque, " +
        "y solo dentro del horario configurado de lunes a martes."
    );
  });

  it("la frase larga calla cuando no hay nada que confirmar", () => {
    // Fecha a medias: no hay momento que anunciar.
    expect(explicarIntervalo(readIntervalConfig(con("date")))).toBeNull();
    // Horario encendido y vacío: no hay ventana que prometer.
    expect(
      explicarIntervalo(readIntervalConfig(con("interval", { scheduleEnabled: true })))
    ).toBeNull();
  });

  it("dos franjas el mismo día se leen las dos, en orden de reloj", () => {
    const config = readIntervalConfig(con("interval", {
      wait: { amount: 3, unit: "minutes" },
      scheduleEnabled: true,
      schedule: horario({
        monday: {
          enabled: true,
          ranges: [{ start: "14:00", end: "18:00" }, { start: "09:00", end: "12:00" }]
        }
      })
    }));

    expect(explicarIntervalo(config)).toBe(
      "La conversación continuará 3 minutos después de llegar a este bloque, " +
        "y solo de lunes, entre 09:00 a.m.–12:00 p.m. y 02:00 p.m.–06:00 p.m."
    );
  });
});

describe("una franja A MEDIO ESCRIBIR se conserva, como media fecha", () => {
  it("conserva la mitad escrita en vez de borrar la franja entera", () => {
    // ESTE FUE UN DEFECTO REAL, y el mismo que ya se había corregido para el
    // momento: el lector exigía las DOS horas completas, así que borrar un
    // campo para reescribirlo hacía desaparecer la fila bajo el cursor y la
    // hora ya puesta era imposible de corregir.
    const leida = readIntervalConfig({
      schedule: { monday: { enabled: true, ranges: [{ start: "09:00", end: "" }] } }
    });

    expect(leida.schedule.monday.ranges).toEqual([{ start: "09:00", end: "" }]);
  });

  it("y también al revés, con el inicio a medias", () => {
    const leida = readIntervalConfig({
      schedule: { monday: { enabled: true, ranges: [{ start: "", end: "18:00" }] } }
    });

    expect(leida.schedule.monday.ranges).toEqual([{ start: "", end: "18:00" }]);
  });

  it("pero una franja SIN NADA no es una franja", () => {
    const leida = readIntervalConfig({
      schedule: { monday: { enabled: true, ranges: [{ start: "", end: "" }] } }
    });

    expect(leida.schedule.monday.ranges).toEqual([]);
  });

  it("conservarla NO la hace guardable: eso lo sigue diciendo la validación", () => {
    // La frontera del módulo: el lector responde «¿qué se puede pintar?» y la
    // validación «¿qué se puede guardar?». Conservar media franja no relaja lo
    // segundo.
    const config = {
      trigger: "interval",
      scheduleEnabled: true,
      schedule: { monday: { enabled: true, ranges: [{ start: "09:00", end: "" }] } }
    };

    expect(readIntervalConfig(config).schedule.monday.ranges).toHaveLength(1);
    expect(validateInterval({}, config).valido).toBe(false);
  });
});
