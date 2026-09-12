import { describe, expect, it } from "vitest";
import {
  aceptaHora,
  aceptaMinuto,
  horaPuedeCrecer,
  esHoraCompleta,
  esMinutoCompleto,
  formatearEnDoce,
  from24Hour,
  normalizarHora,
  normalizarMinuto,
  to24Hour
} from "@features/automations/builder/tools/interval/time12";
import { validateInterval } from "@features/automations/builder/tools/interval/validateInterval";
import { intervalWaitMs, readIntervalConfig } from "@contracts/IntervalConfig";

// ---------------------------------------------------------------------------
// EL DOMINIO DEL RELOJ DE DOCE HORAS, agotado a mano.
//
// Estos dominios son tan pequeños —doce horas, sesenta minutos, dos mitades—
// que no hay que elegir casos representativos: se recorren ENTEROS. Eso es
// exactamente lo que no se podía hacer ni con el control nativo ni con el
// parser de texto libre, y es la razón de que la hora viva ahora en una función
// pura y no dentro de un componente.
// ---------------------------------------------------------------------------

describe("aceptaHora — QUÉ SE PUEDE TECLEAR en el campo de hora", () => {
  it("acepta el vacío: borrar para reescribir es un gesto normal", () => {
    expect(aceptaHora("")).toBe(true);
  });

  it("acepta las doce horas, con cero delante y sin él", () => {
    for (let h = 1; h <= 12; h += 1) {
      expect(aceptaHora(String(h)), String(h)).toBe(true);
      expect(aceptaHora(String(h).padStart(2, "0")), `0${h}`).toBe(true);
    }
  });

  it("acepta «0» porque es el primer paso de «08»", () => {
    expect(aceptaHora("0")).toBe(true);
  });

  it("pero NO «00»: en un reloj de doce no existe la hora cero", () => {
    expect(aceptaHora("00")).toBe(false);
  });

  it("NO acepta letras — este es el caso que tenía que morir", () => {
    for (const basura of ["a", "x", "abc", "10a", "1x", "12x", "10ndjd", "ndjd"]) {
      expect(aceptaHora(basura), basura).toBe(false);
    }
  });

  it("NO acepta símbolos ni separadores", () => {
    for (const basura of ["-", ".", ":", " ", "1 ", " 1", "1.", "1:", "+1", "-1"]) {
      expect(aceptaHora(basura), JSON.stringify(basura)).toBe(false);
    }
  });

  it("NO acepta ninguna hora por encima de doce", () => {
    for (let h = 13; h <= 99; h += 1) {
      expect(aceptaHora(String(h)), String(h)).toBe(false);
    }
  });

  it("en particular, el segundo dígito de «99» no entra", () => {
    expect(aceptaHora("9")).toBe(true);
    expect(aceptaHora("99")).toBe(false);
  });

  it("NO acepta tres cifras: ninguna hora las tiene", () => {
    for (const largo of ["000", "123", "100", "010"]) {
      expect(aceptaHora(largo), largo).toBe(false);
    }
  });
});

describe("aceptaMinuto — QUÉ SE PUEDE TECLEAR en el campo de minutos", () => {
  it("acepta el vacío mientras se edita", () => {
    expect(aceptaMinuto("")).toBe(true);
  });

  it("acepta los sesenta minutos, y también el cero suelto", () => {
    for (let m = 0; m <= 59; m += 1) {
      expect(aceptaMinuto(String(m).padStart(2, "0")), String(m)).toBe(true);
    }
    for (let m = 0; m <= 9; m += 1) {
      expect(aceptaMinuto(String(m)), String(m)).toBe(true);
    }
  });

  it("NO acepta sesenta ni nada por encima", () => {
    for (let m = 60; m <= 99; m += 1) {
      expect(aceptaMinuto(String(m)), String(m)).toBe(false);
    }
  });

  it("en particular, el «0» de «60» no entra", () => {
    expect(aceptaMinuto("6")).toBe(true);
    expect(aceptaMinuto("60")).toBe(false);
  });

  it("NO acepta letras ni símbolos", () => {
    for (const basura of ["a", "9a", "1x", "abc", "10ndjd", ":", "-", " ", "5 "]) {
      expect(aceptaMinuto(basura), JSON.stringify(basura)).toBe(false);
    }
  });

  it("NO acepta tres cifras", () => {
    expect(aceptaMinuto("000")).toBe(false);
    expect(aceptaMinuto("123")).toBe(false);
  });
});

describe("completo ≠ tecleable: son dos preguntas distintas", () => {
  it("el vacío se puede teclear pero no significa ninguna hora", () => {
    expect(aceptaHora("")).toBe(true);
    expect(esHoraCompleta("")).toBe(false);

    expect(aceptaMinuto("")).toBe(true);
    expect(esMinutoCompleto("")).toBe(false);
  });

  it("«0» se puede teclear —es el paso de «08»— pero tampoco es una hora", () => {
    expect(aceptaHora("0")).toBe(true);
    expect(esHoraCompleta("0")).toBe(false);
  });

  it("pero «0» SÍ es un minuto de pleno derecho", () => {
    expect(esMinutoCompleto("0")).toBe(true);
  });
});

describe("normalizar — la forma canónica al SALIR del campo", () => {
  it("«8» se lee «08»", () => {
    expect(normalizarHora("8")).toBe("08");
    expect(normalizarMinuto("5")).toBe("05");
    expect(normalizarMinuto("0")).toBe("00");
  });

  it("lo que ya está en su forma no se toca", () => {
    expect(normalizarHora("08")).toBe("08");
    expect(normalizarHora("12")).toBe("12");
    expect(normalizarMinuto("45")).toBe("45");
  });

  it("NO INVENTA VALORES: lo incompleto se devuelve intacto", () => {
    // Rellenar con ceros lo que la persona no ha terminado de escribir sería
    // ponerle un dato que no puso — «0» pasaría a «00», que ni es una hora.
    expect(normalizarHora("")).toBe("");
    expect(normalizarHora("0")).toBe("0");
    expect(normalizarMinuto("")).toBe("");
  });
});

describe("to24Hour — de las tres piezas a lo que se guarda", () => {
  it("los casos obligatorios del reloj de doce", () => {
    expect(to24Hour("01", "30", "am")).toBe("01:30");
    expect(to24Hour("01", "30", "pm")).toBe("13:30");
    expect(to24Hour("11", "30", "am")).toBe("11:30");
    expect(to24Hour("11", "30", "pm")).toBe("23:30");
    expect(to24Hour("12", "30", "am")).toBe("00:30");
    expect(to24Hour("12", "30", "pm")).toBe("12:30");
  });

  it("LAS DOCE, que es el caso que todo el mundo escribe al revés", () => {
    // 12 a. m. es MEDIANOCHE y 12 p. m. es MEDIODÍA.
    expect(to24Hour("12", "00", "am")).toBe("00:00");
    expect(to24Hour("12", "00", "pm")).toBe("12:00");
  });

  it("y el resto de las obligatorias", () => {
    expect(to24Hour("01", "00", "pm")).toBe("13:00");
    expect(to24Hour("11", "59", "pm")).toBe("23:59");
    expect(to24Hour("01", "00", "am")).toBe("01:00");
  });

  it("acepta la forma sin cero delante, porque es el mismo dato", () => {
    expect(to24Hour("8", "5", "pm")).toBe("20:05");
    expect(to24Hour("8", "5", "am")).toBe("08:05");
  });

  it("`null` mientras falte una pieza: no se guarda a medias", () => {
    expect(to24Hour("", "30", "pm")).toBeNull();
    expect(to24Hour("10", "", "pm")).toBeNull();
    expect(to24Hour("", "", "am")).toBeNull();
    expect(to24Hour("0", "30", "am")).toBeNull();
  });

  it("`null` para lo que el control no deja teclear, si llegara por otro camino", () => {
    expect(to24Hour("13", "00", "pm")).toBeNull();
    expect(to24Hour("00", "00", "am")).toBeNull();
    expect(to24Hour("10", "60", "am")).toBeNull();
    expect(to24Hour("10ndjd", "30", "am")).toBeNull();
    expect(to24Hour("10", "ndjd", "am")).toBeNull();
  });

  it("las 144 combinaciones de hora y mitad del día caen en las 24 del reloj", () => {
    const producidas = new Set<string>();

    for (let h = 1; h <= 12; h += 1) {
      for (const mitad of ["am", "pm"] as const) {
        const salida = to24Hour(String(h), "00", mitad);
        expect(salida, `${h} ${mitad}`).toMatch(/^([01]\d|2[0-3]):00$/);
        producidas.add(salida as string);
      }
    }

    // Ni una hora del día se queda sin poder escribirse, ni dos piezas
    // distintas producen la misma: la traducción es una biyección.
    expect(producidas.size).toBe(24);
  });
});

describe("from24Hour — de lo guardado a lo que se pinta", () => {
  it("devuelve las tres piezas, con el meridiano DEDUCIDO", () => {
    expect(from24Hour("22:30")).toEqual({ hour: "10", minute: "30", meridiem: "pm" });
    expect(from24Hour("14:45")).toEqual({ hour: "02", minute: "45", meridiem: "pm" });
    expect(from24Hour("08:05")).toEqual({ hour: "08", minute: "05", meridiem: "am" });
    expect(from24Hour("00:30")).toEqual({ hour: "12", minute: "30", meridiem: "am" });
    expect(from24Hour("12:30")).toEqual({ hour: "12", minute: "30", meridiem: "pm" });
    expect(from24Hour("23:59")).toEqual({ hour: "11", minute: "59", meridiem: "pm" });
  });

  it("`null` para lo que no es una hora de pared", () => {
    for (const basura of ["", "10ndjd", "abc", "25:00", "14:70", "1445", "9:30", "24:00"]) {
      expect(from24Hour(basura), basura).toBeNull();
    }
  });

  it("IDA Y VUELTA SOBRE LAS 1440 HORAS DEL DÍA, sin perder ni una", () => {
    // Es la propiedad que sostiene «guardar, cerrar y reabrir»: lo que se pinta
    // al volver tiene que ser exactamente lo que se guardó.
    for (let minutos = 0; minutos < 24 * 60; minutos += 1) {
      const canonica = `${String(Math.floor(minutos / 60)).padStart(2, "0")}:${String(
        minutos % 60
      ).padStart(2, "0")}`;

      const piezas = from24Hour(canonica);
      expect(piezas, canonica).not.toBeNull();

      const vuelta = to24Hour(piezas!.hour, piezas!.minute, piezas!.meridiem);
      expect(vuelta, canonica).toBe(canonica);
    }
  });
});

describe("formatearEnDoce — la hora en TEXTO CORRIDO, para los resúmenes", () => {
  it("se lee como se dice", () => {
    expect(formatearEnDoce("13:30")).toBe("01:30 p.m.");
    expect(formatearEnDoce("14:45")).toBe("02:45 p.m.");
    expect(formatearEnDoce("08:05")).toBe("08:05 a.m.");
    expect(formatearEnDoce("00:00")).toBe("12:00 a.m.");
    expect(formatearEnDoce("12:00")).toBe("12:00 p.m.");
    expect(formatearEnDoce("23:59")).toBe("11:59 p.m.");
  });

  it("`null` si lo guardado no es una hora: no se le inventa un formato", () => {
    for (const basura of ["", "14", "25:00", "abc", "10ndjd"]) {
      expect(formatearEnDoce(basura), basura).toBeNull();
    }
  });
});


describe("horaPuedeCrecer — la regla del AUTOAVANCE, preguntada al dominio", () => {
  it("espera la segunda cifra solo cuando existe alguna hora que empiece así", () => {
    // «0» y «1» pueden crecer: 01–09, y 10, 11, 12.
    expect(horaPuedeCrecer("0")).toBe(true);
    expect(horaPuedeCrecer("1")).toBe(true);
  });

  it("y NO la espera cuando ninguna hora podría continuar", () => {
    // De 20 a 99 no hay ninguna hora de doce, así que «2»…«9» ya están
    // terminadas: retener el cursor obligaría a teclear «02» donde «2» basta.
    for (let cifra = 2; cifra <= 9; cifra += 1) {
      expect(horaPuedeCrecer(String(cifra)), String(cifra)).toBe(false);
    }
  });

  it("con dos cifras nunca puede crecer", () => {
    for (const hora of ["01", "09", "10", "11", "12", "02"]) {
      expect(horaPuedeCrecer(hora), hora).toBe(false);
    }
  });

  it("el vacío puede crecer: todavía no se ha escrito nada", () => {
    expect(horaPuedeCrecer("")).toBe(true);
  });

  it("cada hora que espera cifra tiene continuación REAL, y las demás no", () => {
    // La propiedad, no los casos: «puede crecer» tiene que significar
    // exactamente «existe una hora válida que empieza por esto».
    for (let cifra = 0; cifra <= 9; cifra += 1) {
      const prefijo = String(cifra);
      const hayContinuacion = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"].some((d) =>
        aceptaHora(`${prefijo}${d}`)
      );

      expect(horaPuedeCrecer(prefijo), prefijo).toBe(hayContinuacion);
    }
  });
});

describe("D · DOMINIO — qué combinaciones existen y cuáles no", () => {
  it("19–24 · el momento es UNO y el horario se SUMA", () => {
    // No son pruebas de interfaz: son del modelo. «Después + Fecha» no se
    // valida —se declara imposible—, porque `trigger` es un solo valor y no
    // hay forma de representar los dos a la vez. Y «horario solo» tampoco
    // existe: siempre hay un `trigger`.
    const config = (extra: Record<string, unknown>) => ({
      trigger: "interval",
      wait: { amount: 5, unit: "minutes" },
      ...extra
    });

    // 21 · Después → válido
    expect(validateInterval({}, config({})).valido).toBe(true);

    // 20 · Fecha → válido
    expect(
      validateInterval(
        {},
        config({ trigger: "date", moment: { date: "2026-09-15", time: "12:45" } })
      ).valido
    ).toBe(true);

    // 22 · Fecha + Horario → válido
    expect(
      validateInterval(
        {},
        config({
          trigger: "date",
          moment: { date: "2026-09-15", time: "12:45" },
          scheduleEnabled: true,
          schedule: { monday: { enabled: true, ranges: [{ start: "09:00", end: "18:00" }] } }
        })
      ).valido
    ).toBe(true);

    // 23 · Después + Horario → válido
    expect(
      validateInterval(
        {},
        config({
          scheduleEnabled: true,
          schedule: { monday: { enabled: true, ranges: [{ start: "09:00", end: "18:00" }] } }
        })
      ).valido
    ).toBe(true);

    // 19 · Horario ACTIVO pero sin ningún día → inválido
    expect(
      validateInterval({}, config({ scheduleEnabled: true, schedule: {} })).valido
    ).toBe(false);
  });

  it("24 · «Después + Fecha» no se rechaza: NO SE PUEDE ESCRIBIR", () => {
    // `trigger` es un único valor, así que la combinación imposible no tiene
    // representación. Lo que el modelo hace inexpresable no necesita una regla
    // que lo rechace — y por eso no hay uno que probar.
    const leida = readIntervalConfig({
      trigger: "date",
      moment: { date: "2026-09-15", time: "12:45" },
      wait: { amount: 5, unit: "minutes" }
    });

    // Los dos momentos CONVIVEN en el dato —volver atrás no borra nada— pero
    // solo uno gobierna, y es el que dice `trigger`.
    expect(leida.trigger).toBe("date");
    expect(leida.wait).toEqual({ amount: 5, unit: "minutes" });
    expect(intervalWaitMs(leida), "la espera gobierna sin ser el trigger").toBeNull();
  });
});
