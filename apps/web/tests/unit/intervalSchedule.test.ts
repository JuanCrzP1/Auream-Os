import { describe, expect, it } from "vitest";
import {
  EMPTY_SCHEDULE,
  SCHEDULE_DEFAULT_RANGE,
  type IntervalSchedule
} from "@contracts/IntervalConfig";
import {
  alternarDia,
  anadirFranja,
  diasActivos,
  diasConsecutivos,
  editarFranja,
  franjasOrdenadas,
  franjasUniformes,
  quitarFranja
} from "@features/automations/builder/tools/interval/intervalSchedule";

// ---------------------------------------------------------------------------
// Las operaciones del horario, sin pantalla.
//
// Cada gesto del editor —encender un día, añadir una franja, moverle la hora—
// es una de estas funciones. Probarlas aquí es lo que permite que el componente
// de horarios sea solo composición.
// ---------------------------------------------------------------------------

const conLunesAbierto = (): IntervalSchedule =>
  alternarDia(EMPTY_SCHEDULE, "monday", true);

describe("encender y apagar un día", () => {
  it("encender un día vacío le da una franja para editar", () => {
    const semana = alternarDia(EMPTY_SCHEDULE, "monday", true);

    expect(semana.monday.enabled).toBe(true);
    expect(semana.monday.ranges).toEqual([SCHEDULE_DEFAULT_RANGE]);
  });

  it("no toca los otros seis días", () => {
    const semana = alternarDia(EMPTY_SCHEDULE, "wednesday", true);

    expect(diasActivos(semana)).toEqual(["wednesday"]);
    expect(semana.monday).toEqual(EMPTY_SCHEDULE.monday);
  });

  it("apagar CONSERVA las franjas: es «hoy no», no «bórrame lo configurado»", () => {
    const abierto = editarFranja(conLunesAbierto(), "monday", 0, "end", "20:00");

    const apagado = alternarDia(abierto, "monday", false);

    expect(apagado.monday.enabled).toBe(false);
    expect(apagado.monday.ranges).toEqual([{ start: "09:00", end: "20:00" }]);
  });

  it("volver a encender devuelve lo que había, sin añadir otra franja", () => {
    const ida = alternarDia(conLunesAbierto(), "monday", false);
    const vuelta = alternarDia(ida, "monday", true);

    expect(vuelta.monday.ranges).toEqual([SCHEDULE_DEFAULT_RANGE]);
  });

  it("no muta la semana que recibe", () => {
    const original = conLunesAbierto();
    const copia = structuredClone(original);

    alternarDia(original, "tuesday", true);
    anadirFranja(original, "monday");

    expect(original).toEqual(copia);
  });
});

describe("franjas", () => {
  it("añadir deja las anteriores y pone la nueva al final", () => {
    const semana = anadirFranja(conLunesAbierto(), "monday");

    expect(semana.monday.ranges).toHaveLength(2);
    expect(semana.monday.ranges[0]).toEqual(SCHEDULE_DEFAULT_RANGE);
  });

  it("admite varias franjas el mismo día", () => {
    let semana = conLunesAbierto();
    semana = anadirFranja(semana, "monday");
    semana = anadirFranja(semana, "monday");

    expect(semana.monday.ranges).toHaveLength(3);
  });

  it("eliminar quita la señalada y deja las demás en su sitio", () => {
    let semana = anadirFranja(conLunesAbierto(), "monday");
    semana = editarFranja(semana, "monday", 1, "start", "14:00");
    semana = editarFranja(semana, "monday", 1, "end", "18:00");

    const quedan = quitarFranja(semana, "monday", 0);

    expect(quedan.monday.ranges).toEqual([{ start: "14:00", end: "18:00" }]);
  });

  it("quitar la ÚLTIMA franja apaga el día", () => {
    // Un día encendido sin franjas es la contradicción que la validación
    // rechaza: quitar la única hora de un día es no querer ese día.
    const vacio = quitarFranja(conLunesAbierto(), "monday", 0);

    expect(vacio.monday.ranges).toEqual([]);
    expect(vacio.monday.enabled).toBe(false);
  });

  it("editar cambia una sola hora de una sola franja", () => {
    let semana = anadirFranja(conLunesAbierto(), "monday");
    semana = editarFranja(semana, "monday", 0, "start", "08:30");

    expect(semana.monday.ranges[0]).toEqual({ start: "08:30", end: "18:00" });
    expect(semana.monday.ranges[1]).toEqual(SCHEDULE_DEFAULT_RANGE);
  });

  it("editar un día no toca los demás", () => {
    let semana = alternarDia(conLunesAbierto(), "friday", true);
    semana = editarFranja(semana, "monday", 0, "end", "23:00");

    expect(semana.friday.ranges).toEqual([SCHEDULE_DEFAULT_RANGE]);
  });

  it("no reordena mientras se edita: eso lo pide quien necesita leerlas", () => {
    let semana = anadirFranja(conLunesAbierto(), "monday");
    semana = editarFranja(semana, "monday", 1, "start", "06:00");
    semana = editarFranja(semana, "monday", 1, "end", "07:00");

    expect(semana.monday.ranges[0].start).toBe("09:00");
    expect(franjasOrdenadas(semana.monday.ranges)[0].start).toBe("06:00");
  });
});

describe("lectura de la semana", () => {
  it("los días activos salen en orden de semana, no de activación", () => {
    let semana = alternarDia(EMPTY_SCHEDULE, "friday", true);
    semana = alternarDia(semana, "monday", true);

    expect(diasActivos(semana)).toEqual(["monday", "friday"]);
  });

  it("reconoce días consecutivos y los que no lo son", () => {
    let seguidos = alternarDia(EMPTY_SCHEDULE, "monday", true);
    seguidos = alternarDia(seguidos, "tuesday", true);
    expect(diasConsecutivos(seguidos)).toBe(true);

    let sueltos = alternarDia(EMPTY_SCHEDULE, "monday", true);
    sueltos = alternarDia(sueltos, "wednesday", true);
    expect(diasConsecutivos(sueltos)).toBe(false);
  });

  it("reconoce si todos los días activos tienen las mismas horas", () => {
    let iguales = alternarDia(EMPTY_SCHEDULE, "monday", true);
    iguales = alternarDia(iguales, "tuesday", true);
    expect(franjasUniformes(iguales)).toBe(true);

    const distintos = editarFranja(iguales, "tuesday", 0, "end", "20:00");
    expect(franjasUniformes(distintos)).toBe(false);
  });

  it("una semana vacía o de un solo día es trivialmente uniforme y consecutiva", () => {
    expect(franjasUniformes(EMPTY_SCHEDULE)).toBe(true);
    expect(diasConsecutivos(EMPTY_SCHEDULE)).toBe(true);
    expect(diasActivos(EMPTY_SCHEDULE)).toEqual([]);
  });
});
