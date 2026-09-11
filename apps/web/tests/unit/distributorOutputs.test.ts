import { describe, expect, it } from "vitest";
import {
  DISTRIBUTOR_DEFAULT_CONFIG,
  anadirSalida,
  normalizarIdDeSalida,
  quitarSalida,
  siguienteRotulo
} from "@features/automations/builder/tools/distributor/distributorOutputs";
import { readDistributorOutputs } from "@features/automations/builder/tools/distributor/readDistributorConfig";
import {
  SALIDAS_DUPLICADAS,
  SALIDA_ILEGIBLE,
  validateDistributor
} from "@features/automations/builder/tools/distributor/validateDistributor";
import { summarizeDistributor } from "@features/automations/builder/tools/distributor/summarizeDistributor";

// ---------------------------------------------------------------------------
// Las salidas de un Distribuidor, sin pantalla de por medio.
//
// Todo lo de aquí es puro: forma, operaciones, lectura defensiva, validación y
// resumen. Lo que se prueba es el COMPORTAMIENTO —qué sale de qué entra— y no
// el texto de ningún control, que vive en las pruebas de componente.
// ---------------------------------------------------------------------------

describe("estado inicial", () => {
  it("un Distribuidor nace sin salidas", () => {
    expect(DISTRIBUTOR_DEFAULT_CONFIG.outputs).toEqual([]);
  });

  it("una configuración vacía se lee como «sin salidas», no como una de cortesía", () => {
    expect(readDistributorOutputs({})).toEqual([]);
    expect(readDistributorOutputs({ outputs: [] })).toEqual([]);
  });
});

describe("añadir salidas", () => {
  it("la primera salida se llama «Salida 1»", () => {
    const [primera, ...resto] = anadirSalida([]);

    expect(primera.label).toBe("Salida 1");
    expect(primera.id.length).toBeGreaterThan(0);
    expect(resto).toEqual([]);
  });

  it("permite tantas salidas como el usuario pida: el contrato no fija un tope", () => {
    // No hay número mágico que comprobar porque no hay número mágico: se añaden
    // muchas y todas entran. Si algún día el producto decide un tope, esta
    // prueba es la que tendrá que cambiar, y a propósito.
    let salidas = DISTRIBUTOR_DEFAULT_CONFIG.outputs;
    for (let i = 0; i < 12; i += 1) salidas = anadirSalida(salidas);

    expect(salidas).toHaveLength(12);
    expect(salidas.map((salida) => salida.label)).toEqual([
      "Salida 1", "Salida 2", "Salida 3", "Salida 4", "Salida 5", "Salida 6",
      "Salida 7", "Salida 8", "Salida 9", "Salida 10", "Salida 11", "Salida 12"
    ]);
  });

  it("cada salida nace con una identidad propia, también en la misma llamada", () => {
    const salidas = anadirSalida(anadirSalida(anadirSalida([])));
    const ids = salidas.map((salida) => salida.id);

    expect(new Set(ids).size).toBe(3);
  });

  it("no muta la lista que recibe", () => {
    const original = anadirSalida([]);
    const copia = [...original];

    anadirSalida(original);

    expect(original).toEqual(copia);
  });
});

describe("eliminar salidas", () => {
  it("quita la señalada y deja intactas las demás, con su identidad", () => {
    const [uno, dos, tres] = anadirSalida(anadirSalida(anadirSalida([])));

    const quedan = quitarSalida([uno, dos, tres], dos.id);

    expect(quedan).toEqual([uno, tres]);
  });

  it("borrar por identidad y no por posición: el rótulo de las otras no cambia", () => {
    // Lo que protege esta prueba es una conexión ya hecha: si al borrar la
    // primera se renumeraran las siguientes, el punto al que alguien conectó
    // «Salida 3» pasaría a llamarse «Salida 2» sin haberse movido.
    const [uno, dos, tres] = anadirSalida(anadirSalida(anadirSalida([])));

    const quedan = quitarSalida([uno, dos, tres], uno.id);

    expect(quedan.map((salida) => salida.label)).toEqual(["Salida 2", "Salida 3"]);
    expect(quedan.map((salida) => salida.id)).toEqual([dos.id, tres.id]);
  });

  it("la salida creada después de borrar no repite el nombre de una viva", () => {
    const [uno, dos, tres] = anadirSalida(anadirSalida(anadirSalida([])));
    const quedan = quitarSalida([uno, dos, tres], uno.id);

    const conNueva = anadirSalida(quedan);

    expect(conNueva.map((salida) => salida.label)).toEqual([
      "Salida 2",
      "Salida 3",
      "Salida 4"
    ]);
    expect(new Set(conNueva.map((salida) => salida.label)).size).toBe(3);
  });

  it("borrar algo que ya no está deja la lista igual, sin fallar", () => {
    const salidas = anadirSalida([]);

    expect(quitarSalida(salidas, "ds-que-no-existe")).toEqual(salidas);
  });

  it("vaciar todas devuelve al estado inicial", () => {
    const [unica] = anadirSalida([]);

    expect(quitarSalida([unica], unica.id)).toEqual([]);
  });
});

describe("rótulo de la siguiente salida", () => {
  it("cuenta desde el mayor existente, no desde el total", () => {
    expect(siguienteRotulo([])).toBe("Salida 1");
    expect(siguienteRotulo([{ id: "a", label: "Salida 7" }])).toBe("Salida 8");
  });

  it("ignora los rótulos que no siguen la forma «Salida n»", () => {
    expect(siguienteRotulo([{ id: "a", label: "Ventas" }])).toBe("Salida 1");
    expect(
      siguienteRotulo([
        { id: "a", label: "Ventas" },
        { id: "b", label: "Salida 2" }
      ])
    ).toBe("Salida 3");
  });

  it("añadir usa ese mismo rótulo: una sola forma de nombrar", () => {
    // Se comprueba por el camino público. La fábrica interna no se exporta a
    // propósito: probarla aparte sería fijar el cómo en vez del qué, y dejaría
    // una segunda manera de crear salidas al alcance de quien pase por aquí.
    const [, nueva] = anadirSalida([{ id: "a", label: "Salida 4" }]);

    expect(nueva.label).toBe("Salida 5");
  });
});

describe("qué cuenta como identidad de una salida", () => {
  // La regla vive en el dominio porque la aplican DOS: el lector, para decidir
  // qué puede pintarse, y la validación, para decidir qué puede guardarse.
  // Estaba escrita en los dos sitios y esto es lo que evita que diverjan.

  it("acepta texto con contenido y lo devuelve limpio", () => {
    expect(normalizarIdDeSalida("ds-1")).toBe("ds-1");
    expect(normalizarIdDeSalida("  ds-1  ")).toBe("ds-1");
  });

  it("rechaza lo que no puede ser un punto de conexión", () => {
    for (const basura of ["", "   ", null, undefined, 7, {}, []]) {
      expect(normalizarIdDeSalida(basura), `aceptó ${JSON.stringify(basura)}`).toBeNull();
    }
  });

  it("el lector y la validación coinciden sobre el mismo dato", () => {
    // El contrato real entre los dos: lo que el lector no consigue leer como
    // salida es exactamente lo que la validación no deja guardar. Si alguien
    // endurece una de las dos orillas, esta prueba lo dice.
    for (const id of ["", "   ", null, 7]) {
      const config = { outputs: [{ id, label: "Salida 1" }] };

      expect(readDistributorOutputs(config), `leyó ${JSON.stringify(id)}`).toEqual([]);
      expect(validateDistributor({}, config).valido, `guardó ${JSON.stringify(id)}`).toBe(false);
    }
  });
});

describe("lectura defensiva de lo guardado", () => {
  it("descarta lo que no es una salida representable", () => {
    const salidas = readDistributorOutputs({
      outputs: [null, "texto", 7, { label: "sin id" }, { id: "ds-1", label: "Salida 1" }]
    });

    expect(salidas).toEqual([{ id: "ds-1", label: "Salida 1" }]);
  });

  it("una salida sin id se descarta: su punto de conexión no existiría", () => {
    expect(readDistributorOutputs({ outputs: [{ id: "   ", label: "Salida 1" }] })).toEqual([]);
  });

  it("un rótulo perdido se repone por posición en vez de tirar la salida", () => {
    const salidas = readDistributorOutputs({
      outputs: [{ id: "ds-1" }, { id: "ds-2", label: "" }]
    });

    expect(salidas).toEqual([
      { id: "ds-1", label: "Salida 1" },
      { id: "ds-2", label: "Salida 2" }
    ]);
  });

  it("con ids repetidos conserva el primero: dos puntos iguales serían ambiguos", () => {
    const salidas = readDistributorOutputs({
      outputs: [
        { id: "ds-1", label: "Salida 1" },
        { id: "ds-1", label: "Salida 2" }
      ]
    });

    expect(salidas).toEqual([{ id: "ds-1", label: "Salida 1" }]);
  });

  it("un `outputs` que no es lista se lee como sin salidas", () => {
    expect(readDistributorOutputs({ outputs: "tres" })).toEqual([]);
    expect(readDistributorOutputs({ outputs: null })).toEqual([]);
  });
});

describe("qué puede guardarse", () => {
  it("un Distribuidor sin salidas se guarda: es el estado con el que nace", () => {
    expect(validateDistributor({}, {})).toEqual({ valido: true, motivo: null });
    expect(validateDistributor({}, { outputs: [] })).toEqual({ valido: true, motivo: null });
  });

  it("con salidas bien formadas, se guarda", () => {
    const salidas = anadirSalida(anadirSalida([]));

    expect(validateDistributor({}, { outputs: salidas })).toEqual({
      valido: true,
      motivo: null
    });
  });

  it("rechaza dos salidas con la misma identidad", () => {
    const validez = validateDistributor({}, {
      outputs: [
        { id: "ds-1", label: "Salida 1" },
        { id: "ds-1", label: "Salida 2" }
      ]
    });

    expect(validez.valido).toBe(false);
    expect(validez.motivo).toBe(SALIDAS_DUPLICADAS);
  });

  it("rechaza una salida sin identidad legible", () => {
    expect(validateDistributor({}, { outputs: [{ label: "Salida 1" }] }).motivo)
      .toBe(SALIDA_ILEGIBLE);
    expect(validateDistributor({}, { outputs: [null] }).motivo).toBe(SALIDA_ILEGIBLE);
  });

  it("VALIDA EL CRUDO, no lo que el lector sanea", () => {
    // El lector se queda con la primera de dos salidas repetidas para poder
    // pintar algo coherente. La validación mira lo que el usuario tiene
    // guardado y sí lo señala: son dos preguntas distintas sobre el mismo dato.
    const corrupto = {
      outputs: [
        { id: "ds-1", label: "Salida 1" },
        { id: "ds-1", label: "Salida 2" }
      ]
    };

    expect(readDistributorOutputs(corrupto)).toHaveLength(1);
    expect(validateDistributor({}, corrupto).valido).toBe(false);
  });
});

describe("resumen para la tarjeta", () => {
  it("cuenta las salidas, en singular y plural", () => {
    expect(summarizeDistributor({}, {})).toBe("Sin salidas");
    expect(summarizeDistributor({}, { outputs: anadirSalida([]) })).toBe("1 salida");
    expect(summarizeDistributor({}, { outputs: anadirSalida(anadirSalida([])) })).toBe(
      "2 salidas"
    );
  });

  it("cuenta lo LEGIBLE, no lo que hay escrito", () => {
    expect(summarizeDistributor({}, { outputs: [{ id: "ds-1", label: "A" }, null] })).toBe(
      "1 salida"
    );
  });
});
