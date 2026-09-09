import { describe, expect, it } from "vitest";
import {
  WAIT_RESPONSE_DEFAULT_CONFIG,
  WAIT_RESPONSE_DEFAULT_TIMEOUT,
  esCantidadValida,
  esUnidadValida,
  readWaitResponseConfig,
  resolveContextKey,
  waitResponseTimeoutMs
} from "../../contracts/WaitResponseConfig.js";

// ---------------------------------------------------------------------------
// El contrato compartido de «Esperar respuesta».
//
// Lo leen las dos orillas —el editor del builder y `QuestionNodeHandler`—, así
// que lo que se fija aquí es el significado del dato, no la interfaz: qué nace
// por defecto, qué se acepta de un JSON que pudo escribir otra versión y cuánto
// dura una espera en milisegundos.
// ---------------------------------------------------------------------------

describe("configuración por defecto", () => {
  it("nace con tiempo máximo de 30 minutos, no con sin límite", () => {
    // Decisión de producto: el editor debe mostrarse con «Esperar sin límite»
    // apagado y el tiempo máximo ya listo, no al revés.
    expect(WAIT_RESPONSE_DEFAULT_CONFIG).toEqual({
      waitIndefinitely: false,
      timeout: WAIT_RESPONSE_DEFAULT_TIMEOUT,
      groupMessages: false,
      replyToInbound: false
    });
    expect(WAIT_RESPONSE_DEFAULT_TIMEOUT).toEqual({ amount: 30, unit: "minutes" });
  });

  it("el default declara un vencimiento que el motor todavía no hace cumplir", () => {
    // Dicho sin maquillaje: el timeout por defecto SÍ se puede calcular —
    // `waitResponseTimeoutMs` no devuelve null—, pero nada en el motor lo hace
    // vencer hoy (Fase C). Un nodo recién creado con este default espera en la
    // práctica indefinidamente aunque su editor muestre 30 minutos. Este test
    // fija esa brecha para que no se cierre por accidente ni se dé por resuelta
    // sin haber tocado el runtime.
    expect(waitResponseTimeoutMs(WAIT_RESPONSE_DEFAULT_CONFIG)).toBe(1_800_000);
  });
});

describe("readWaitResponseConfig", () => {
  it("lee una configuración completa tal cual", () => {
    expect(
      readWaitResponseConfig({
        waitIndefinitely: false,
        timeout: { amount: 30, unit: "minutes" },
        groupMessages: true,
        replyToInbound: true,
        reaction: "👍",
        targetKey: "ciudad"
      })
    ).toEqual({
      waitIndefinitely: false,
      timeout: { amount: 30, unit: "minutes" },
      groupMessages: true,
      replyToInbound: true,
      reaction: "👍",
      targetKey: "ciudad"
    });
  });

  it("un config VACÍO se lee como espera sin límite: fallback de seguridad, no el default del producto", () => {
    // Distinto, a propósito, de `WAIT_RESPONSE_DEFAULT_CONFIG`. Este caso es un
    // JSON sin el campo —viejo, corrupto o literalmente `{}`— y el lector no
    // inventa un límite que nadie escribió. `WAIT_RESPONSE_DEFAULT_CONFIG` es
    // otra pregunta: qué le muestra el editor a alguien que crea un nodo nuevo
    // desde la paleta. Que difieran es correcto, no un error de sincronía.
    expect(readWaitResponseConfig({})).toEqual({
      waitIndefinitely: true,
      groupMessages: false,
      replyToInbound: false
    });
    expect(readWaitResponseConfig({})).not.toEqual(WAIT_RESPONSE_DEFAULT_CONFIG);
  });

  it("solo un false explícito quita el «sin límite»", () => {
    // Cualquier basura deja el nodo en lo que el motor sí sabe hacer, en lugar
    // de inventar un límite que nadie pidió.
    for (const valor of [undefined, null, 0, "", "no"]) {
      expect(readWaitResponseConfig({ waitIndefinitely: valor }).waitIndefinitely).toBe(true);
    }
    expect(readWaitResponseConfig({ waitIndefinitely: false }).waitIndefinitely).toBe(false);
  });

  it("descarta un timeout corrupto en vez de romperse", () => {
    const corruptos = [
      { amount: 0, unit: "minutes" },
      { amount: -5, unit: "minutes" },
      { amount: 2.5, unit: "minutes" },
      { amount: "30", unit: "minutes" },
      { amount: 30, unit: "days" },
      { amount: 30 },
      null,
      "30 minutos"
    ];

    for (const timeout of corruptos) {
      expect(readWaitResponseConfig({ waitIndefinitely: false, timeout }).timeout).toBeUndefined();
    }
  });

  it("recorta el destino y descarta el que quede vacío", () => {
    expect(readWaitResponseConfig({ targetKey: "  ciudad  " }).targetKey).toBe("ciudad");
    expect(readWaitResponseConfig({ targetKey: "   " }).targetKey).toBeUndefined();
    expect(readWaitResponseConfig({ targetKey: 42 }).targetKey).toBeUndefined();
  });

  it("NORMALIZA el destino: quita el prefijo técnico `context.` al leerlo", () => {
    // Antes solo recortaba espacios, así que con `context.ciudad` guardado la
    // tarjeta decía «Guarda en context.ciudad» y el motor escribía en `ciudad`:
    // el usuario leía un nombre de campo que no era el que se usaba.
    expect(readWaitResponseConfig({ targetKey: "context.ciudad" }).targetKey).toBe("ciudad");
    expect(readWaitResponseConfig({ targetKey: "  context.correo  " }).targetKey).toBe("correo");
    expect(readWaitResponseConfig({ targetKey: "ciudad" }).targetKey).toBe("ciudad");
  });

  it("la clave que lee el contrato es EXACTAMENTE la que el motor usará", () => {
    // Es la propiedad que se buscaba: una sola clave para mostrar y para
    // escribir en contexto. `resolveContextKey` sobre lo ya normalizado es
    // idempotente, así que el motor puede seguir llamándolo sin cambiar nada.
    for (const guardado of ["ciudad", "context.ciudad", "  context.ciudad  "]) {
      const leida = readWaitResponseConfig({ targetKey: guardado }).targetKey;

      expect(leida).toBe("ciudad");
      expect(resolveContextKey(leida)).toBe("ciudad");
    }
  });

  it("un destino que solo era el prefijo no deja clave", () => {
    expect(readWaitResponseConfig({ targetKey: "context." }).targetKey).toBeUndefined();
  });

  it("una reacción vacía equivale a no reaccionar", () => {
    expect(readWaitResponseConfig({ reaction: "" }).reaction).toBeUndefined();
    expect(readWaitResponseConfig({ reaction: "  " }).reaction).toBeUndefined();
    expect(readWaitResponseConfig({ reaction: "❤️" }).reaction).toBe("❤️");
  });

  it("conserva los interruptores solo cuando son true de verdad", () => {
    expect(readWaitResponseConfig({ groupMessages: "sí", replyToInbound: 1 })).toMatchObject({
      groupMessages: false,
      replyToInbound: false
    });
  });
});

describe("waitResponseTimeoutMs", () => {
  it("sin límite no vence nunca", () => {
    expect(
      waitResponseTimeoutMs({ waitIndefinitely: true, groupMessages: false, replyToInbound: false })
    ).toBeNull();
  });

  it("convierte minutos y horas", () => {
    const base = { waitIndefinitely: false, groupMessages: false, replyToInbound: false } as const;

    expect(waitResponseTimeoutMs({ ...base, timeout: { amount: 30, unit: "minutes" } })).toBe(1_800_000);
    expect(waitResponseTimeoutMs({ ...base, timeout: { amount: 1, unit: "minutes" } })).toBe(60_000);
    expect(waitResponseTimeoutMs({ ...base, timeout: { amount: 2, unit: "hours" } })).toBe(7_200_000);
  });

  it("con límite pero sin timeout no puede calcular nada", () => {
    expect(
      waitResponseTimeoutMs({ waitIndefinitely: false, groupMessages: false, replyToInbound: false })
    ).toBeNull();
  });
});

describe("guardas de unidad y cantidad", () => {
  it("acepta minutos y horas y nada más", () => {
    expect(esUnidadValida("minutes")).toBe(true);
    expect(esUnidadValida("hours")).toBe(true);
    for (const otra of ["seconds", "days", "", null, undefined, 3]) {
      expect(esUnidadValida(otra)).toBe(false);
    }
  });

  it("acepta enteros positivos y nada más", () => {
    expect(esCantidadValida(1)).toBe(true);
    expect(esCantidadValida(120)).toBe(true);
    for (const otra of [0, -1, 1.5, "3", NaN, Infinity, null, undefined]) {
      expect(esCantidadValida(otra)).toBe(false);
    }
  });
});

describe("resolveContextKey", () => {
  it("devuelve la clave sin el prefijo context.", () => {
    expect(resolveContextKey("ciudad")).toBe("ciudad");
    expect(resolveContextKey("context.ciudad")).toBe("ciudad");
    expect(resolveContextKey("  context.ciudad  ")).toBe("ciudad");
  });

  it("sin clave utilizable devuelve null", () => {
    for (const vacia of ["", "   ", null, undefined, 7]) {
      expect(resolveContextKey(vacia)).toBeNull();
    }
  });
});
