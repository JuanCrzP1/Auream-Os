import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { resolveTool } from "@features/automations/builder/tools/registry";
import { resolveToolUi } from "@features/automations/builder/tools/ui-registry";

// ---------------------------------------------------------------------------
// Contratos ARQUITECTÓNICOS del Programador (nodo `delay`).
//
// Aquí no se renderiza nada ni se pulsa nada: eso es `IntervalNode.test.tsx`.
// Lo que se fija aquí son las fronteras del módulo —qué declara, de qué no
// depende, qué no sabe de él la infraestructura genérica—, que es el tipo de
// propiedad que no se rompe con un fallo visible sino con una degradación lenta
// que nadie nota hasta que duele.
// ---------------------------------------------------------------------------

const RAIZ = "src/features/automations/builder/tools/interval";

function fuenteSinComentarios(ruta: string): string {
  return readFileSync(ruta, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
}

const modulo = (nombre: string) => fuenteSinComentarios(`${RAIZ}/${nombre}`);

/**
 * Todo el módulo, LEÍDO DEL DISCO y no escrito a mano.
 *
 * Una lista a mano se queda corta en silencio: el archivo que alguien añada
 * mañana no la rompe, sencillamente escapa de todas las comprobaciones de
 * abajo — que es justo lo contrario de lo que un test de arquitectura tiene que
 * hacer. Recorriendo la carpeta, un módulo nuevo entra al régimen el día que
 * nace.
 */
function fuentesDe(subcarpeta = ""): ReadonlyArray<string> {
  const base = subcarpeta === "" ? RAIZ : `${RAIZ}/${subcarpeta}`;

  return readdirSync(base, { withFileTypes: true }).flatMap((entrada) => {
    const nombre = subcarpeta === "" ? entrada.name : `${subcarpeta}/${entrada.name}`;

    if (entrada.isDirectory()) return fuentesDe(nombre);

    return /\.tsx?$/.test(entrada.name) ? [nombre] : [];
  });
}

const MODULOS = fuentesDe();

/**
 * Lo que tiene que ser lógica pura, sin React de por medio.
 *
 * LA EXTENSIÓN ES EL CRITERIO, no una lista: `.ts` significa «esto no dibuja»
 * y `.tsx` «esto dibuja». Es la misma frontera que separa `registry.ts` de
 * `ui-registry.tsx` en el catálogo, y aquí se aplica igual. `definition.ts`
 * queda dentro a propósito: declara la herramienta y tampoco puede tocar el
 * DOM.
 */
const MODULOS_PUROS = MODULOS.filter((nombre) => nombre.endsWith(".ts"));

const COMPONENTES = MODULOS.filter((nombre) => nombre.endsWith(".tsx"));

describe("el contrato cruza al motor, y por eso vive en contracts/", () => {
  it("la forma de la configuración está en `contracts/`, no en la carpeta del tool", () => {
    // ES LA REGLA QUE EL PROPIO REPO DOCUMENTA. `DelayNodeHandler` no es un
    // handler de mentira —aparca la sesión en `delayed` y `ExecutionLoop` lo
    // respeta—, así que lo que el editor escriba tendrá que leerlo el motor.
    // `contracts/` es la única ruta compartida entre las dos orillas; un tipo
    // declarado en `tools/interval/` sería invisible para el backend.
    //
    // Compárese con Distribuidor, cuyo modelo SÍ vive en su carpeta porque su
    // handler falla con `not_implemented` y nunca abre la configuración.
    const contrato = readFileSync("../../contracts/IntervalConfig.ts", "utf8");

    expect(contrato).toMatch(/export interface IntervalConfig/);
    expect(contrato).toMatch(/export function readIntervalConfig/);
    expect(contrato).toMatch(/export function intervalWaitMs/);
  });

  it("el contrato es PURO: ningún módulo de navegador ni de servidor", () => {
    // Lo importan un componente de navegador y —cuando exista la cola— un
    // handler de servidor. Un `import` de React o de `node:` lo dejaría fuera
    // del alcance de uno de los dos, y lo haría sin romper nada visible.
    const contrato = fuenteSinComentarios("../../contracts/IntervalConfig.ts");

    expect(contrato).not.toMatch(/from\s+["']react["']/);
    expect(contrato).not.toMatch(/from\s+["']@xyflow/);
    expect(contrato).not.toMatch(/from\s+["']node:/);
    expect(contrato).not.toMatch(/\bimport\s/);
  });

  it("NO inventa una zona horaria ni una fuente de horarios que no existan", () => {
    // El proyecto no tiene timezone por tenant ni horarios de funcionamiento.
    // Guardar un instante exigiría elegir una zona por el usuario y escribirla
    // en disco; ofrecer «usar los horarios de funcionamiento» sería un
    // interruptor que no apunta a nada. Se guarda hora de pared y punto.
    const contrato = readFileSync("../../contracts/IntervalConfig.ts", "utf8");

    expect(contrato).not.toMatch(/America\/|Europe\/|UTC[+-]|getTimezoneOffset/);
    expect(contrato).not.toMatch(/toISOString|Date\.now\(\)/);
  });
});

describe("la lógica pura se mantiene pura", () => {
  it("horario, validación y resumen no importan React ni el lienzo", () => {
    for (const nombre of MODULOS_PUROS) {
      const fuente = modulo(nombre);

      expect(fuente, `${nombre} importa React`).not.toMatch(/from\s+["']react["']/);
      expect(fuente, `${nombre} importa React Flow`).not.toMatch(/from\s+["']@xyflow/);
      expect(fuente, `${nombre} importa una hoja de estilos`).not.toMatch(/\.css["']/);

      // La extensión ES la barrera: un `.ts` no admite JSX y lo impide el
      // compilador, no una prueba.
      expect(nombre, `${nombre} debería ser .ts`).toMatch(/\.ts$/);
    }
  });

  it("no tocan el DOM ni el almacenamiento del navegador", () => {
    for (const nombre of MODULOS_PUROS) {
      const fuente = modulo(nombre);

      expect(fuente, `${nombre} usa el DOM`).not.toMatch(/\b(document|window)\./);
      expect(fuente, `${nombre} usa almacenamiento`).not.toMatch(/localStorage|sessionStorage/);
    }
  });

  it("ningún componente reimplementa una regla del dominio", () => {
    // Los componentes COMPONEN: traducen un gesto a la operación pura que
    // corresponde. Si alguno decidiera por su cuenta qué pasa al encender un
    // día o cuándo una franja es válida, habría dos sitios donde arreglar la
    // misma regla y solo uno estaría probado.
    for (const nombre of COMPONENTES) {
      const fuente = modulo(nombre);

      expect(fuente, `${nombre} valida por su cuenta`).not.toMatch(/minutosDelDia|esHoraValida|esFechaValida/);
      expect(fuente, `${nombre} construye franjas a mano`).not.toMatch(/09:00|18:00/);
    }
  });
});

describe("la hora NO depende del control nativo del navegador", () => {
  it("no queda ni un `input[type=\"time\"]` en toda la herramienta", () => {
    // ESTA ES LA DECISIÓN, Y ES ARQUITECTÓNICA. `<input type="time">` no es una
    // caja de texto: es un editor de SEGMENTOS que cada motor implementa a su
    // manera. En WebKit resultó imposible de manejar —una hora ya guardada no
    // se podía cambiar— y no se intentó domarlo una vez más: se retiró. Si
    // alguien lo reintroduce, el fallo vuelve entero y en silencio, así que la
    // ausencia se comprueba, no se confía.
    for (const nombre of COMPONENTES) {
      expect(modulo(nombre), `${nombre} volvió al control nativo de hora`).not.toMatch(
        /type=["']time["']/
      );
    }
  });

  it("la hora son TRES CONTROLES, y su dominio vive en una función PURA", () => {
    // LA DECISIÓN CENTRAL. Una caja de texto —da igual lo listo que sea el
    // parser detrás— acepta texto, y «10ndjd» es texto. La hora no es una
    // cadena: son tres datos con dominios cerrados, y por eso se editan en tres
    // controles que no dejan teclear lo que no les pertenece.
    const fuente = modulo("editor/IntervalTimeControl.tsx");

    expect(fuente).toMatch(/aria-label="Hora"/);
    expect(fuente).toMatch(/aria-label="Minutos"/);
    // El a.m./p.m. se PULSA, no se escribe.
    expect(fuente).toMatch(/aria-pressed=\{meridiem === valor\}/);
    // Y los dos puntos no son de ningún campo: son un elemento aparte.
    expect(fuente).toMatch(/iv-time__colon/);

    // Lo que sabe qué es una hora vive fuera del componente, así que se puede
    // agotar a mano sin levantar un navegador.
    expect(fuente).toMatch(/from\s+["']\.\.\/time12["']/);
    expect(fuente, "el componente decide por su cuenta qué hora es válida").not.toMatch(
      /[<>]=?\s*(12|59|23)\b/
    );
  });

  it("EL PARSER DE TEXTO LIBRE ESTÁ MUERTO, y no queda ni el archivo", () => {
    // Mientras hubo texto libre que interpretar, hubo un camino por el que la
    // basura entraba al estado. Al cerrarlo, el parser dejó de tener trabajo:
    // mantenerlo sería conservar una segunda manera de construir una hora que
    // la interfaz ya no permite.
    expect(MODULOS, "el parser sigue en disco").not.toContain("parseTimeInput.ts");
    expect(MODULOS, "el campo de texto libre sigue en disco").not.toContain(
      "editor/IntervalTimeField.tsx"
    );

    for (const nombre of MODULOS) {
      expect(modulo(nombre), `${nombre} sigue llamando al parser`).not.toMatch(
        /parseTimeInput/
      );
    }
  });

  it("la restricción vive EN EL CONTROL, no en un aviso posterior", () => {
    // ES LA REGLA QUE IMPIDE QUE VUELVA EL BUG. Lo que no pertenece al dominio
    // se descarta ANTES de tocar el estado: no se acepta para rechazarlo
    // después. `validateInterval` sigue siendo la segunda barrera, no la
    // primera experiencia.
    const fuente = modulo("editor/IntervalTimeControl.tsx");

    expect(fuente).toMatch(/if \(!aceptaHora\(texto\)\) return rechazar\(\)/);
    expect(fuente).toMatch(/if \(!aceptaMinuto\(texto\)\) return rechazar\(\)/);
  });

  it("el calendario PASÓ A SER CONTROLADO: ahí estaba el fallo de Guardar", () => {
    // ESTO FUE EL DEFECTO REAL, no una preferencia de estilo. Sin controlar, el
    // campo era una SEGUNDA FUENTE DE VERDAD que React no podía corregir: al
    // resincronizarse el borrador del marco, el DOM seguía enseñando la fecha
    // recién elegida mientras el borrador había vuelto a la guardada. De ahí
    // salía «la fecha se ve pero Guardar dice que falta».
    const fuente = modulo("editor/IntervalDateFields.tsx");

    expect(fuente).toMatch(/value=\{moment\?\.date \?\? ""\}/);
    expect(fuente, "el calendario volvió a no estar controlado").not.toMatch(/defaultValue/);
  });

  it("el control de hora también sigue al borrador: lo tecleado CADUCA", () => {
    // El borrador local existe para poder enseñar un campo a medias —vacío, o
    // «8» sin cero—, que ninguna hora guardada representa. Pero lleva apuntado
    // contra qué valor se escribió, y en cuanto ese valor cambia por otro
    // camino se tira. Sin esa caducidad, el control repetiría la divergencia
    // que acaba de quitarse del calendario.
    const fuente = modulo("editor/IntervalTimeControl.tsx");

    expect(fuente).toMatch(/borrador\.base === value/);
  });

  it("cada campo conserva al otro: escribir uno no borra el que ya estaba", () => {
    // El hermano se lee de la CONFIGURACIÓN, no del DOM, así que lo que pase en
    // un campo no puede destruir el valor del otro.
    const fuente = modulo("editor/IntervalDateFields.tsx");

    expect(fuente).toMatch(/date:\s*evento\.target\.value,\s*time:\s*moment\?\.time/);
    expect(fuente).toMatch(/date:\s*moment\?\.date\s*\?\?\s*"",\s*time/);
  });
});

describe("la infraestructura genérica no sabe que existe esta herramienta", () => {
  it("ni la tarjeta, ni el marco, ni la hoja del lienzo la nombran", () => {
    const genericos = [
      "src/features/automations/builder/components/canvas/FlowNodeCard.tsx",
      "src/features/automations/builder/components/canvas/NodeExpandedFrame.tsx",
      "src/features/automations/builder/components/canvas/flow-node.css",
      "src/features/automations/builder/components/canvas/BuilderCanvas.tsx"
    ];

    for (const ruta of genericos) {
      const fuente = readFileSync(ruta, "utf8").toLowerCase();

      expect(fuente, `${ruta} nombra al Programador`).not.toMatch(
        /programador|\biv-|tools\/interval/
      );
    }
  });

  it("los registros importan exactamente su mitad, y nada más de dentro", () => {
    for (const ruta of [
      "src/features/automations/builder/tools/registry.ts",
      "src/features/automations/builder/tools/ui-registry.tsx"
    ]) {
      const importes = [
        ...readFileSync(ruta, "utf8").matchAll(/from\s+["']\.\/interval\/([^"']+)["']/g)
      ];

      expect(importes).toHaveLength(1);
      expect(importes[0][1]).toMatch(/^(definition|ui)$/);
    }
  });
});

describe("independencia frente a las otras herramientas", () => {
  it("ningún módulo importa de Mensaje, Esperar respuesta ni Distribuidor", () => {
    // Mensaje tiene su propio bloque de «intervalo» dentro de una secuencia:
    // es OTRA cosa —una pausa entre dos envíos del mismo mensaje— y compartir
    // código con ella por el parecido del nombre ataría dos herramientas que no
    // tienen nada que ver.
    for (const nombre of MODULOS) {
      expect(modulo(nombre), `${nombre} importa de otra herramienta`).not.toMatch(
        /from\s+["'][^"']*tools\/(message|wait-response|distributor)/
      );
    }
  });
});

describe("la herramienta está bien declarada en el catálogo", () => {
  it("declara editor, cuerpo propio, resumen y validación", () => {
    const ui = resolveToolUi("delay");
    const tool = resolveTool("delay");

    expect(ui.Editor).toBeDefined();
    expect(ui.CompactBody).toBeDefined();
    expect(tool.summarize).toBeDefined();
    expect(tool.validateContent).toBeDefined();
  });

  it("NO declara salidas propias: el Programador tiene un solo camino", () => {
    expect(resolveToolUi("delay").ownsOutputs).toBeUndefined();
  });

  it("se llama «Programador» en pantalla, pero su tipo sigue siendo `delay`", () => {
    // El rótulo es pantalla; el tipo es DATO —la clave del nodo en el snapshot—
    // y renombrarlo rompería los flujos ya guardados. Solo uno de los dos tenía
    // que cambiar.
    const tool = resolveTool("delay");

    expect(tool.label).toBe("Programador");
    expect(tool.type).toBe("delay");
    expect(tool.description.length).toBeGreaterThan(0);
  });

  it("conserva el cyan aprobado, sin tocarlo", () => {
    const tool = resolveTool("delay");

    expect(tool.colors.header).toBe("#0891b2");
    expect(tool.colors.body).toBe("#0e7490");
    expect(tool.colors.gradient).toContain("#22d3ee");
  });

  it("sigue declarando que el motor la ejecuta: no se ha fingido nada en ninguna dirección", () => {
    // `executable: true` es honesto —el handler aparca la sesión de verdad—; lo
    // que falta es la cola que la despierte, y eso no lo decide esta bandera.
    expect(resolveTool("delay").executable).toBe(true);
  });
});

describe("estilos acotados al tool", () => {
  const hoja = readFileSync(`${RAIZ}/interval-editor.css`, "utf8");

  it("ningún selector suelto: el prefijo ES el aislamiento", () => {
    const selectores = [...hoja.matchAll(/^([^\s/@}][^{]*)\{/gm)].map(([, s]) => s.trim());

    expect(selectores.length).toBeGreaterThan(0);
    for (const selector of selectores) {
      expect(selector, `selector sin acotar: ${selector}`).toMatch(/^\.(interval|iv-)/);
    }
  });

  it("se pinta con tokens del tema, no con colores de un solo modo", () => {
    for (const token of ["--text", "--muted", "--border", "--surface", "--surface-alt"]) {
      expect(hoja, `no usa ${token}`).toContain(`var(${token})`);
    }
  });

  it("el cyan del editor es el mismo que publica la definición", () => {
    const tool = resolveTool("delay");

    expect(hoja).toContain(`--iv-cyan: ${tool.colors.header};`);
    expect(hoja).toContain(`--iv-deep: ${tool.colors.body};`);
  });

  it("el contenido del editor NO se tiñe del violeta de la marca", () => {
    // ESTO FUE UN DEFECTO REAL. Un `<input type="date">` resalta el segmento
    // enfocado con el color de SELECCIÓN del documento, que es el violeta de
    // AUREAM: «11/09/2026» salía morado sin que esta hoja escribiera un color.
    // Se corrige acotando la selección y el `accent-color` al editor, nunca
    // tocando el token global.
    expect(hoja).toMatch(/accent-color:\s*var\(--iv-cyan\)/);
    expect(hoja).toMatch(/\.interval ::selection/);

    // Y el violeta del sistema no se usa como color en ninguna DECLARACIÓN: la
    // identidad de esta herramienta es el cyan. Se mira la hoja sin comentarios
    // —el de arriba nombra el token justo para explicar por qué no se usa—.
    const declaraciones = hoja.replace(/\/\*[\s\S]*?\*\//g, "");
    expect(declaraciones).not.toMatch(/var\(--primary\)|--selection-bg/);
  });

  it("neutraliza el resalte de sistema de los segmentos, en los dos motores", () => {
    // El bloque de color que salía dentro del campo lo pinta el NAVEGADOR con
    // el color de resalte del SO, no esta hoja. Blink y WebKit no aceptan la
    // misma forma del selector, así que hacen falta las dos —y en reglas
    // SEPARADAS: un selector que un motor no entiende invalida toda su lista.
    const declaraciones = hoja.replace(/\/\*[\s\S]*?\*\//g, "");

    expect(declaraciones, "falta la forma de Blink").toMatch(
      /\.iv-date__input:focus::-webkit-datetime-edit-day-field/
    );
    expect(declaraciones, "falta la forma de WebKit").toMatch(
      /\.iv-date__input::-webkit-datetime-edit-day-field:focus/
    );

    // Las dos van en bloques distintos: si estuvieran en la misma lista, el
    // motor que no reconoce una descartaría también la otra.
    // Solo los bloques DE FOCO: el de color en reposo es otra cosa y se
    // comprueba aparte.
    const bloques = declaraciones
      .split("}")
      .filter((b) => b.includes("datetime-edit") && b.includes(":focus"));
    expect(bloques.length).toBeGreaterThanOrEqual(2);

    // Y al quitar el fondo hay que declarar el color: si no, el segmento activo
    // hereda `HighlightText` y en oscuro queda ilegible.
    for (const bloque of bloques) {
      expect(bloque, "segmento sin fondo neutralizado").toMatch(/background-color:\s*transparent/);
      expect(bloque, "segmento sin color declarado").toMatch(/color:\s*var\(--text\)/);
    }
  });

  it("fija el color del contenido del control en REPOSO, no solo con foco", () => {
    // El defecto que se vio en Safari era un campo SIN foco con todo el valor
    // teñido —dígitos, barras y «p.m.»—: no el resalte del segmento activo,
    // sino el color del texto. En Blink los segmentos heredan el color del
    // input; WebKit los pinta desde su propia hoja y esa herencia no llega, así
    // que hay que nombrarlos, y sin `:focus`.
    const declaraciones = hoja.replace(/\/\*[\s\S]*?\*\//g, "");
    const bloque = declaraciones
      .split("}")
      .find((b) => b.includes("::-webkit-datetime-edit,") || b.includes("::-webkit-datetime-edit\n"));

    expect(bloque, "falta la regla de color en reposo").toBeDefined();
    // El separador «/» y los dos puntos son un pseudo-elemento aparte.
    expect(bloque).toContain("::-webkit-datetime-edit-text");
    // `-webkit-text-fill-color` gana sobre `color` al pintar el glifo: si solo
    // se declarara `color`, el agente de usuario podría seguir imponiendo el suyo.
    expect(bloque).toMatch(/-webkit-text-fill-color:\s*var\(--text\)/);
    expect(bloque).toMatch(/color:\s*var\(--text\)/);
  });

  it("al neutralizar el segmento, el foco del campo entero es la señal que queda", () => {
    // Es lo que sustituye al resalte nativo, y es también lo único que tiene
    // Firefox —que no implementa esos pseudo-elementos—. Va en `:focus` y no en
    // `:focus-visible` para que se vea también llegando con el ratón.
    const declaraciones = hoja.replace(/\/\*[\s\S]*?\*\//g, "");
    const foco = declaraciones.slice(declaraciones.indexOf(".iv-date__input:focus {"));
    const cuerpo = foco.slice(0, foco.indexOf("}"));

    expect(cuerpo).toMatch(/border-color:\s*var\(--iv-cyan\)/);
    expect(cuerpo).toMatch(/var\(--iv-soft\)/);
  });

  it("los valores van en el color del texto, no en un acento", () => {
    // La fecha, la hora y el número son CONTENIDO: el dato que el usuario fija.
    // El cyan aparece en el foco y en la selección, no pintando el valor.
    for (const regla of [".iv-date__input", ".iv-wait__amount", ".iv-time__field"]) {
      const cuerpo = hoja.slice(hoja.indexOf(`${regla} {`));
      const declaraciones = cuerpo.slice(0, cuerpo.indexOf("}"));

      expect(declaraciones, `${regla} no usa el color de texto`).toMatch(
        /color:\s*var\(--text\)/
      );
    }
  });

  it("respeta el movimiento reducido", () => {
    expect(hoja).toMatch(/@media \(prefers-reduced-motion: reduce\)/);
    expect(hoja).toMatch(/animation: none/);
  });

  it("sin !important, sin position fixed y sin z-index arbitrario", () => {
    expect(hoja).not.toMatch(/!important/);
    expect(hoja).not.toMatch(/position:\s*fixed/);
    expect(hoja).not.toMatch(/z-index/);
  });
});
