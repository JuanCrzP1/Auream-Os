import { describe, expect, it } from "vitest";
import {
  CONTENIDO_SIN_FUENTE,
  SIN_CONTENIDO,
  validateMessageContent
} from "@features/automations/builder/tools/message/validateMessageContent";
import { getTool } from "@features/automations/builder/tools/registry";

// ---------------------------------------------------------------------------
// ¿Hay algo que enviar?
//
// La decisión vive en un módulo PURO: sin React, sin editor, sin botón de
// guardar, sin lienzo y sin base de datos. Por eso estas pruebas no montan
// nada — le pasan configuraciones y leen la respuesta.
//
// La regla de producto: cuentan como contenido Texto, Imagen, Video, Audio y
// Archivo; NO cuenta Intervalo, que es tiempo entre dos envíos. Y un medio solo
// cuenta si tiene de dónde sacar lo que envía.
// ---------------------------------------------------------------------------

const validar = (items: ReadonlyArray<Record<string, unknown>>) =>
  validateMessageContent({}, { items });

const texto = (text = "Hola") => ({ id: "t", kind: "text", text });
const pausa = (id = "p") => ({ id, kind: "interval", amount: 5, unit: "seconds" });
const medio = (kind: string, url = "") => ({ id: kind, kind, url, caption: "", sendOnce: false });
/** El mismo medio, pero configurado con un archivo del dispositivo. */
const conArchivo = (kind: string, fileName = "foto.png") => ({
  id: kind,
  kind,
  url: "",
  fileName,
  caption: "",
  sendOnce: false
});

const MEDIOS = ["image", "video", "audio", "file"] as const;
const ENLACE = "https://cdn.test/archivo.ext";

describe("un mensaje sin nada que enviar no es válido", () => {
  it("una secuencia vacía", () => {
    expect(validar([])).toEqual({ valido: false, motivo: SIN_CONTENIDO });
  });

  it("una sola pausa", () => {
    expect(validar([pausa()])).toEqual({ valido: false, motivo: SIN_CONTENIDO });
  });

  it("varias pausas seguidas", () => {
    expect(validar([pausa("a"), pausa("b"), pausa("c")])).toEqual({
      valido: false,
      motivo: SIN_CONTENIDO
    });
  });

  it("una configuración que ni siquiera trae secuencia", () => {
    expect(validateMessageContent({}, {})).toEqual({ valido: false, motivo: SIN_CONTENIDO });
  });
});

describe("un medio sin fuente no basta por sí solo", () => {
  it.each(MEDIOS)("%s sin enlace, como único contenido, no vale", (kind) => {
    // El motivo es OTRO: aquí sí hay contenido puesto, lo que falta es el
    // archivo. Decirle «agrega contenido» a quien ya puso una imagen sería
    // mandarle a buscar algo que él ve delante.
    expect(validar([medio(kind)])).toEqual({ valido: false, motivo: CONTENIDO_SIN_FUENTE });
  });

  it.each(MEDIOS)("%s con enlace válido sí vale", (kind) => {
    expect(validar([medio(kind, ENLACE)])).toEqual({ valido: true, motivo: null });
  });

  it("un enlace que no es http(s) no cuenta como fuente", () => {
    expect(validar([medio("image", "ftp://cdn.test/foto.png")]).valido).toBe(false);
    expect(validar([medio("image", "no-es-una-url")]).valido).toBe(false);
    expect(validar([medio("image", "   ")]).valido).toBe(false);
  });

  it("basta con que UNO de los medios tenga fuente", () => {
    expect(validar([medio("image"), medio("video", ENLACE), medio("audio")])).toEqual({
      valido: true,
      motivo: null
    });
  });
});

describe("el contenido válido hace válido el mensaje", () => {
  it("solo texto", () => {
    expect(validar([texto()])).toEqual({ valido: true, motivo: null });
  });

  it.each(MEDIOS)("solo %s con fuente", (kind) => {
    expect(validar([medio(kind, ENLACE)]).valido).toBe(true);
  });

  it("texto y una pausa", () => {
    expect(validar([texto(), pausa()]).valido).toBe(true);
  });

  it("imagen con fuente y una pausa", () => {
    expect(validar([medio("image", ENLACE), pausa()]).valido).toBe(true);
  });

  it("video, audio y una pausa", () => {
    expect(
      validar([medio("video", ENLACE), medio("audio", ENLACE), pausa()]).valido
    ).toBe(true);
  });

  it("los cinco tipos de contenido y una pausa", () => {
    expect(
      validar([texto(), ...MEDIOS.map((k) => medio(k, ENLACE)), pausa()]).valido
    ).toBe(true);
  });

  it("la pausa nunca aporta validez, solo acompaña", () => {
    // Mismos bloques, quitando el contenido: deja de valer.
    expect(validar([texto(), pausa()]).valido).toBe(true);
    expect(validar([pausa()]).valido).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// UNA FUENTE BASTA: archivo O enlace.
//
// Es un OR, no una lista de requisitos. A quien ya eligió una foto de su disco
// no se le puede pedir además un enlace — ese era el defecto.
// ---------------------------------------------------------------------------

describe("para un medio basta con UNA fuente", () => {
  it.each(MEDIOS)("%s con ARCHIVO elegido es válido", (kind) => {
    expect(validar([conArchivo(kind)])).toEqual({ valido: true, motivo: null });
  });

  it.each(MEDIOS)("%s con ENLACE es válido", (kind) => {
    expect(validar([medio(kind, ENLACE)])).toEqual({ valido: true, motivo: null });
  });

  it.each(MEDIOS)("%s SIN ninguna de las dos no es válido", (kind) => {
    expect(validar([medio(kind)])).toEqual({ valido: false, motivo: CONTENIDO_SIN_FUENTE });
  });

  it.each(MEDIOS)("%s con archivo y una pausa sigue siendo válido", (kind) => {
    expect(validar([conArchivo(kind), pausa()]).valido).toBe(true);
  });

  it("tener las dos fuentes también vale", () => {
    expect(validar([{ ...conArchivo("image"), url: ENLACE }]).valido).toBe(true);
  });

  it("un nombre de archivo en blanco no cuenta como fuente", () => {
    expect(validar([conArchivo("image", "")]).valido).toBe(false);
    expect(validar([conArchivo("image", "   ")]).valido).toBe(false);
  });

  it("la validez NO depende de que el archivo sobreviva a recargar", () => {
    // Validez y persistencia son dos preguntas distintas. El borrador está
    // bien configurado; que los bytes no sobrevivan es asunto de la Fase C.
    expect(validar([conArchivo("video", "clip.mp4")]).valido).toBe(true);
  });
});

describe("un bloque de texto vale por sí mismo, aunque esté en blanco", () => {
  it("es la regla acordada, y su consecuencia queda anotada", () => {
    // Poner un bloque de texto ya declara que ahí va un mensaje. La regla
    // enumera «Texto → VÁLIDO» sin condiciones y no se le añaden aquí.
    expect(validar([texto("")]).valido).toBe(true);
    expect(validar([texto("   ")]).valido).toBe(true);
  });
});

describe("la herramienta expone la decisión al cascarón del editor", () => {
  it("Mensaje declara `validateContent`; las demás no exigen nada", () => {
    expect(getTool("message")?.validateContent).toBeTypeOf("function");

    for (const type of ["tags", "condition", "menu", "notification", "end"]) {
      expect(getTool(type)?.validateContent, `'${type}' exige algo`).toBeUndefined();
    }
  });

  it("lo que declara es exactamente esta función", () => {
    const desdeElRegistry = getTool("message")!.validateContent!;

    expect(desdeElRegistry({}, { items: [] })).toEqual(validar([]));
    expect(desdeElRegistry({}, { items: [texto()] })).toEqual(validar([texto()]));
  });
});

describe("el módulo es puro", () => {
  it("no modifica lo que recibe", () => {
    const items = [texto(), medio("image", ENLACE), pausa()];
    const copia = JSON.parse(JSON.stringify(items));

    validar(items);

    expect(items).toEqual(copia);
  });

  it("la misma entrada da siempre la misma respuesta", () => {
    const items = [medio("video")];
    expect(validar(items)).toEqual(validar(items));
  });
});
