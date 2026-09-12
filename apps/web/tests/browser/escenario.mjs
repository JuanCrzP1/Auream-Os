// ---------------------------------------------------------------------------
// LO QUE SE COMPRUEBA EN UN NAVEGADOR DE VERDAD, escrito UNA sola vez.
//
// POR QUÉ NO VIVE DENTRO DEL RUNNER DE CHROME. Porque el fallo que motiva todo
// esto NO SE REPRODUCE EN CHROME: se vio en Safari. Un escenario escrito dentro
// del runner de Chrome sería un escenario que solo se puede ejecutar donde el
// bug no aparece, y eso no prueba nada. Aquí están las aserciones y allí, la
// forma de entregar una pulsación; cada motor trae la suya y responde a las
// MISMAS preguntas. Si Chrome dice verde y Safari rojo, la diferencia es del
// motor y no de dos pruebas que se escribieron distinto.
//
// EL CONDUCTOR ES UN CONTRATO MÍNIMO, a propósito:
//
//   js(expresion)       → evalúa en la página y devuelve el valor
//   clic(selector)      → un clic REAL del ratón dentro del elemento
//   seleccionarTodo()   → el «seleccionar todo» del sistema sobre lo enfocado
//   teclear(texto)      → pulsaciones REALES, una por carácter
//   borrar()           → la tecla de retroceso, para vaciar un campo
//   tabular()           → salta al siguiente campo, que es como se confirma
//   pulsarBoton(texto)  → activa el botón que dice ese texto
//   recargar()          → vuelve al estado inicial del banco
//
// «REAL» no es un adorno: llamar a `onChange` o escribir `.value` desde JS se
// salta justamente la capa donde vive el bug, y una prueba que haga eso da
// verde con el fallo puesto. Ya pasó.
//
// SE PRUEBA EL CONTROL DEL PRODUCTO, no uno preparado para la prueba. Los
// campos se buscan por su NOMBRE ACCESIBLE —«Hora», «Minutos», «a. m.»,
// «p. m.»—, el mismo que usa cualquiera, y no por un selector que solo exista
// aquí.
//
// LA HORA SON TRES CONTROLES, y esta prueba los maneja como tres. Volcar
// «02:45 p. m.» de un golpe en un campo probaría una interfaz que ya no
// existe: se entra en la hora, se escribe, se entra en los minutos, se escribe,
// y se PULSA la mitad del día. Es el gesto de una persona, y es el único que
// demuestra que «10ndjd» no cabe.
// ---------------------------------------------------------------------------

/** Lo que el nodo del banco trae guardado, en la forma de la versión ANTERIOR. */
export const FECHA_SEMBRADA = "2026-09-12";

const SIN_DIAS = "Activa al menos un día para que la conversación pueda continuar.";

/** Por su NOMBRE ACCESIBLE, no por un selector inventado para la prueba. */
const HORA = 'input[aria-label="Hora"]';
const MINUTOS = 'input[aria-label="Minutos"]';
const FECHA = 'input[aria-label="Fecha"]';

/** Pulsa la mitad del día. Es un BOTÓN: no se escribe, se elige. */
const pulsarMitad = (rotulo) =>
  `[...document.querySelectorAll('button[aria-pressed]')]
     .find(b => b.textContent.trim() === ${JSON.stringify(rotulo)})
     ?.click() ?? 'NO ENCONTRADO'`;

/** Cuál de las dos mitades está pulsada ahora mismo. */
const MITAD_ACTIVA = `[...document.querySelectorAll('button[aria-pressed=true]')]
  .map(b => b.textContent.trim())
  .find(t => t === 'a. m.' || t === 'p. m.') ?? null`;

/** Cuántas mitades están pulsadas a la vez. Tiene que ser exactamente una. */
const MITADES_PULSADAS = `[...document.querySelectorAll('button[aria-pressed=true]')]
  .filter(b => ['a. m.','p. m.'].includes(b.textContent.trim())).length`;

/**
 * La cantidad de la espera, por su etiqueta REAL.
 *
 * Este campo se nombra con un `<label for>`, no con `aria-label`, así que se
 * busca como lo haría un lector de pantalla: por la etiqueta que lo apunta.
 */
const ESPERA = `(() => {
  const etiqueta = [...document.querySelectorAll('label')]
    .find(l => l.textContent.trim() === 'Esperar durante');
  return etiqueta ? (document.getElementById(etiqueta.htmlFor)?.value ?? null) : null;
})()`;

/** Qué campo tiene el foco AHORA, por su nombre accesible. */
const FOCO = `document.activeElement?.getAttribute('aria-label') ?? document.activeElement?.tagName ?? null`;

/**
 * ¿SE VE de verdad el contenido del momento principal?
 *
 * MIDE LOS CAMPOS, NO EL PANEL, y esa distinción es justo la que se me escapó
 * la primera vez. El panel tiene altura por sus dos pestañas aunque su cuerpo
 * esté recortado a cero, así que preguntarle a él daba «visible» mientras la
 * fecha y la hora habían desaparecido de la pantalla.
 *
 * Lo que se comprueba es que el cuerpo del panel QUEPA DENTRO del panel: si el
 * reparto flex le roba altura y `overflow: hidden` lo recorta, esto se pone
 * rojo. Es exactamente la forma del bug que se reportó.
 */
const MOMENTO_VISIBLE = `(() => {
  const panel = document.querySelector('.iv-panel');
  const cuerpo = document.querySelector('.iv-panel__body');
  const campos = document.querySelector('.iv-date, .iv-wait');
  if (!panel || !cuerpo || !campos) return 'falta ' + (!panel ? 'panel' : !cuerpo ? 'cuerpo' : 'campos');

  const p = panel.getBoundingClientRect();
  const c = cuerpo.getBoundingClientRect();
  const f = campos.getBoundingClientRect();

  if (f.height === 0 || f.width === 0) return 'campos sin tamaño';
  // Un margen de 1px por el redondeo de los bordes.
  if (c.bottom > p.bottom + 1) return 'cuerpo RECORTADO por el panel: ' +
    Math.round(c.bottom - p.bottom) + 'px fuera';
  return true;
})()`;

/** ¿Se solapan el momento y la tarjeta del horario? Nunca deben. */
const SIN_SOLAPE = `(() => {
  const panel = document.querySelector('.iv-panel');
  const extra = document.querySelector('.iv-extra');
  if (!panel || !extra) return 'faltan secciones';
  const p = panel.getBoundingClientRect(), e = extra.getBoundingClientRect();
  return e.top >= p.bottom - 1 ? true : 'el horario invade el momento en ' +
    Math.round(p.bottom - e.top) + 'px';
})()`;

/** Los dos puntos, que no pertenecen a ningún campo y nunca se van. */
const DOS_PUNTOS = `document.querySelector('.iv-time__colon')?.textContent ?? null`;

/** Lo que se LEE en el control, montado a partir de sus tres piezas. */
const RELOJ = `(() => {
  const v = (s) => document.querySelector(s)?.value ?? null;
  const h = v('input[aria-label="Hora"]');
  const m = v('input[aria-label="Minutos"]');
  if (h === null || m === null) return null;
  const mitad = [...document.querySelectorAll('button[aria-pressed=true]')]
    .map(b => b.textContent.trim())
    .find(t => t === 'a. m.' || t === 'p. m.') ?? '?';
  return h + ' : ' + m + ' ' + mitad;
})()`;

const valor = (sel) => `document.querySelector(${JSON.stringify(sel)})?.value ?? null`;
const ALERTA = `document.querySelector('[role=alert]')?.textContent ?? null`;
const GUARDADO = `document.getElementById('guardado')?.textContent ?? null`;

/**
 * LA CONFIGURACIÓN REAL DEL NODO, no lo que se lee en pantalla.
 *
 * Es la única comprobación que prueba que el contrato no se movió: la interfaz
 * habla en doce horas y el disco sigue guardando `HH:mm` de veinticuatro.
 */
const config = (campo) =>
  `(JSON.parse(document.getElementById('config-cruda')?.textContent ?? '{}').moment ?? {})[${JSON.stringify(campo)}] ?? null`;

/** ¿Está el botón Guardar habilitado AHORA MISMO? */
const GUARDAR_HABILITADO = `(() => {
  const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === 'Guardar');
  return b === undefined ? 'NO HAY BOTÓN' : !b.disabled;
})()`;

const CONFIG_HORA = config("time");
const CONFIG_FECHA = config("date");

/** El momento principal REALMENTE guardado en el nodo. */
const CONFIG_TRIGGER = `JSON.parse(document.getElementById('config-cruda')?.textContent ?? '{}').trigger ?? null`;

/** Pulsa el interruptor cuya etiqueta dice exactamente ese texto. */
const conmutar = (etiqueta) =>
  `[...document.querySelectorAll('[role=switch]')]
     .find(s => document.getElementById(s.getAttribute('aria-labelledby'))?.textContent === ${JSON.stringify(etiqueta)})
     ?.click() ?? 'NO ENCONTRADO'`;

/** Elige el momento principal por su nombre accesible. */
const elegir = (nombre) =>
  `[...document.querySelectorAll('[role=radio]')]
     .find(b => b.getAttribute('aria-label') === ${JSON.stringify(nombre)})
     ?.click() ?? 'NO ENCONTRADO'`;

const estadoDe = (etiqueta) =>
  `[...document.querySelectorAll('[role=switch]')]
     .find(s => document.getElementById(s.getAttribute('aria-labelledby'))?.textContent === ${JSON.stringify(etiqueta)})
     ?.getAttribute('aria-checked') ?? null`;

/**
 * Corre el escenario completo contra un navegador ya abierto en el banco.
 *
 * `comprobar(descripcion, real, esperado)` lo pone quien invoca, para que cada
 * runner informe con su propio formato sin que el escenario sepa de consolas.
 */
export async function correrEscenario(conductor, comprobar) {
  const { js, clic, seleccionarTodo, teclear, tabular, borrar, pulsarBoton, recargar, pausa } = conductor;

  // -------------------------------------------------------------------------
  console.log("\nA · EL CONTROL DE HORA, manejado COMO UNA PERSONA");
  // -------------------------------------------------------------------------
  // El banco nace con `mode: "date"`, la forma de la versión anterior, así que
  // esta primera comprobación prueba de paso que un nodo guardado con el modelo
  // viejo se sigue abriendo donde su dueño lo dejó.
  comprobar(
    "un nodo heredado abre en su mismo momento principal",
    await js(`document.querySelector('[role=radio][aria-checked=true]')?.getAttribute('aria-label')`),
    "En una fecha"
  );
  comprobar("muestra la fecha guardada", await js(valor(FECHA)), FECHA_SEMBRADA);

  // LA HORA GUARDADA SE LEE EN DOCE HORAS Y EN PIEZAS: «12:30» es «12 : 30 p. m.».
  comprobar("muestra la hora guardada, en piezas y en doce horas", await js(RELOJ), "12 : 30 p. m.");
  comprobar("los dos puntos existen y son del control, no de un campo", await js(DOS_PUNTOS), ":");
  comprobar("solo UNA mitad del día está pulsada", await js(MITADES_PULSADAS), 1);

  // NO EXISTE NINGÚN `input[type=time]` EN LA PANTALLA. Se comprueba en el
  // navegador real porque es donde el control nativo aparecería.
  comprobar(
    "no queda ni un control nativo de hora",
    await js(`document.querySelectorAll('input[type=time]').length`),
    0
  );

  // ----- EL CASO QUE TENÍA QUE MORIR, tecleado de verdad -----
  //
  // Pulsaciones REALES sobre el campo real. Si el control dejara entrar letras,
  // aquí se vería: es exactamente el gesto que produjo «10ndjd».
  await clic(HORA);
  await seleccionarTodo();
  await teclear("10ndjd");
  await pausa(200);

  comprobar("«10ndjd» NO entra en el campo de hora", await js(valor(HORA)), "10");

  await clic(MINUTOS);
  await seleccionarTodo();
  await teclear("60");
  await pausa(200);
  comprobar("«60» no cabe en los minutos: se queda en «6»", await js(valor(MINUTOS)), "6");

  // «99» CON AUTOAVANCE: el primer «9» ya es una hora terminada —no existen las
  // 90— así que el foco se va, y el segundo «9» cae en los minutos. Lo que se
  // comprueba sigue siendo lo mismo: 99 no llega a ser una hora en ninguna
  // parte.
  await clic(HORA);
  await seleccionarTodo();
  await teclear("99");
  await pausa(250);
  comprobar("«99» no llega a ser una hora: queda «09»", await js(valor(HORA)), "09");
  comprobar("y el segundo 9 cae en los minutos, no en la hora", await js(valor(MINUTOS)), "9");

  // ----- LA SECUENCIA DEL ENCARGO: 02 : 45 p. m. -----
  await recargar();
  await pausa(320);

  await clic(HORA);
  await seleccionarTodo();
  await teclear("02");
  await clic(MINUTOS);
  await seleccionarTodo();
  await teclear("45");
  await js(pulsarMitad("p. m."));
  await pausa(300);

  comprobar("queda 02 : 45 p. m.", await js(RELOJ), "02 : 45 p. m.");
  comprobar("y sigue habiendo una sola mitad pulsada", await js(MITADES_PULSADAS), 1);
  comprobar("la fecha NO se movió al tocar la hora", await js(valor(FECHA)), FECHA_SEMBRADA);

  await pulsarBoton("Guardar");
  comprobar("guardar no reclama nada", await js(ALERTA), null);
  // LA CONFIGURACIÓN REAL DEL NODO, en 24 horas: el contrato no se movió.
  comprobar("el nodo guarda la hora en 24 horas", await js(CONFIG_HORA), "14:45");
  comprobar("y también la fecha, junto a ella", await js(CONFIG_FECHA), FECHA_SEMBRADA);
  comprobar("el nodo resume lo guardado", await js(GUARDADO), "12 sep 2026 · 02:45 p.m.");

  // ----- CERRAR Y REABRIR -----
  await pulsarBoton("reabrir");
  await pausa(320);
  comprobar("al reabrir, la fecha sigue", await js(valor(FECHA)), FECHA_SEMBRADA);
  comprobar("al reabrir, la hora sigue en sus piezas", await js(RELOJ), "02 : 45 p. m.");
  comprobar("y con la tarde pulsada", await js(MITAD_ACTIVA), "p. m.");

  // ----- EDITAR CADA PIEZA POR SEPARADO -----
  await clic(HORA);
  await seleccionarTodo();
  await teclear("08");
  await pausa(250);
  comprobar("cambiar la hora deja los minutos y la mitad", await js(RELOJ), "08 : 45 p. m.");

  await clic(MINUTOS);
  await seleccionarTodo();
  await teclear("05");
  await pausa(250);
  comprobar("cambiar los minutos deja la hora y la mitad", await js(RELOJ), "08 : 05 p. m.");

  await js(pulsarMitad("a. m."));
  await pausa(250);
  comprobar("cambiar la mitad no toca hora ni minutos", await js(RELOJ), "08 : 05 a. m.");
  comprobar("la fecha sigue intacta tras las tres ediciones", await js(valor(FECHA)), FECHA_SEMBRADA);

  await pulsarBoton("Guardar");
  comprobar("y la configuración real dice 08:05", await js(CONFIG_HORA), "08:05");

  // ----- BORRADO TEMPORAL: se puede vaciar, pero no guardar a medias -----
  await recargar();
  await pausa(320);
  await clic(HORA);
  await seleccionarTodo();
  await borrar();
  await pausa(250);

  comprobar("el campo puede quedarse vacío mientras se edita", await js(valor(HORA)), "");
  comprobar("y los minutos siguen ahí", await js(valor(MINUTOS)), "30");
  comprobar("los dos puntos NO desaparecen con el campo vacío", await js(DOS_PUNTOS), ":");

  await pulsarBoton("Guardar");
  comprobar(
    "pero una hora incompleta NO se guarda",
    await js(ALERTA),
    "Elige la fecha y la hora en las que continuar."
  );

  // -------------------------------------------------------------------------
  console.log("\nA2 · EL CICLO COMPLETO DE UN NODO NUEVO, con el botón vigilado");
  // -------------------------------------------------------------------------
  // ES EL CRITERIO DE CIERRE, recorrido entero y sin saltarse un paso: crear,
  // elegir fecha, poner la hora, guardar, cerrar, volver, editar y guardar otra
  // vez. Lo que se vigila en cada tramo NO es solo el valor: es el ESTADO DEL
  // BOTÓN, porque «no puedo guardar» es el síntoma que se reportó y puede venir
  // de dos sitios distintos —no hay cambios, o lo que hay no vale— que desde
  // fuera se parecen y no son lo mismo.
  await pulsarBoton("nuevo");
  await pausa(500);

  comprobar(
    "un nodo recién creado no tiene nada que guardar todavía",
    await js(GUARDAR_HABILITADO),
    false
  );

  await js(elegir("En una fecha"));
  await pausa(400);
  comprobar("elegir FECHA ya es un cambio", await js(GUARDAR_HABILITADO), true);

  // Pero un cambio NO es una configuración completa: son dos cosas distintas.
  await pulsarBoton("Guardar");
  comprobar(
    "con cambios pero sin fecha ni hora, Guardar explica qué falta",
    await js(ALERTA),
    "Elige la fecha y la hora en las que continuar."
  );

  // 17 · TEST 4 — hora sin fecha NO guarda.
  await clic(HORA);
  await seleccionarTodo();
  await teclear("02");
  await clic(MINUTOS);
  await seleccionarTodo();
  await teclear("45");
  await js(pulsarMitad("p. m."));
  await pausa(300);
  await pulsarBoton("Guardar");
  comprobar(
    "TEST 4 · hora sin fecha NO guarda",
    await js(ALERTA),
    "Elige la fecha y la hora en las que continuar."
  );

  // LA FECHA SE PONE POR EL VALOR, Y AQUÍ ESTÁ EL PORQUÉ.
  //
  // Es la ÚNICA excepción a «todo con pulsaciones reales», y es deliberada: un
  // `<input type="date">` se teclea por SEGMENTOS EN EL ORDEN DE LA LOCALE
  // —«09112026» significa una cosa en una máquina y otra en la de al lado—, así
  // que teclearlo ataría la prueba al idioma del sistema y daría rojos que no
  // son del producto. Se escribe el valor con el setter nativo y se despachan
  // `input` y `change`: eso NO se salta a React —entra por el mismo `onChange`
  // del componente— ni se salta el estado; solo se salta la edición por
  // segmentos del control del sistema, que no es código nuestro.
  //
  // El CONTROL DE HORA, que sí es nuestro y es lo que se está probando, se
  // maneja siempre con clics y pulsaciones de verdad.
  await js(`(() => {
    const f = document.querySelector('input[aria-label="Fecha"]');
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    set.call(f, '2026-09-11');
    f.dispatchEvent(new Event('input', { bubbles: true }));
    f.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
  await pausa(400);

  comprobar("la fecha entra en el campo", await js(valor(FECHA)), "2026-09-11");
  comprobar("y la hora no se movió al ponerla", await js(RELOJ), "02 : 45 p. m.");
  comprobar("con todo completo, Guardar está habilitado", await js(GUARDAR_HABILITADO), true);

  await pulsarBoton("Guardar");
  comprobar("TEST 2 · fecha + hora GUARDA", await js(ALERTA), null);

  // EL PAYLOAD REAL DEL NODO, no una simulación del commit.
  comprobar("el nodo guarda la fecha", await js(CONFIG_FECHA), "2026-09-11");
  comprobar("el nodo guarda la hora en 24 horas", await js(CONFIG_HORA), "14:45");
  comprobar("y el momento principal es la cita", await js(CONFIG_TRIGGER), "date");

  // ----- CERRAR Y VOLVER -----
  await pulsarBoton("reabrir");
  await pausa(450);
  comprobar("al volver, la fecha está donde se dejó", await js(valor(FECHA)), "2026-09-11");
  comprobar("al volver, la hora está donde se dejó", await js(RELOJ), "02 : 45 p. m.");
  comprobar(
    "y sin cambios, Guardar vuelve a estar quieto",
    await js(GUARDAR_HABILITADO),
    false
  );

  // ----- EDITAR LO YA GUARDADO: 02:45 p. m. → 08:05 a. m. -----
  await clic(HORA);
  await seleccionarTodo();
  await teclear("08");
  await pausa(220);
  comprobar("cambiar la hora conserva los minutos", await js(RELOJ), "08 : 45 p. m.");

  await clic(MINUTOS);
  await seleccionarTodo();
  await teclear("05");
  await pausa(220);
  comprobar("cambiar los minutos conserva la hora", await js(RELOJ), "08 : 05 p. m.");

  await js(pulsarMitad("a. m."));
  await pausa(250);
  comprobar("y la mañana no toca las cifras", await js(RELOJ), "08 : 05 a. m.");
  comprobar("la fecha aguantó las tres ediciones", await js(valor(FECHA)), "2026-09-11");
  comprobar("con cambios, Guardar se habilita otra vez", await js(GUARDAR_HABILITADO), true);

  await pulsarBoton("Guardar");
  comprobar("el segundo guardado tampoco reclama nada", await js(ALERTA), null);
  comprobar("y la configuración real dice 08:05", await js(CONFIG_HORA), "08:05");
  comprobar("sin haber tocado la fecha", await js(CONFIG_FECHA), "2026-09-11");

  await pulsarBoton("reabrir");
  await pausa(450);
  comprobar("al volver por segunda vez, sigue 08 : 05 a. m.", await js(RELOJ), "08 : 05 a. m.");
  comprobar("y la fecha sigue siendo la suya", await js(valor(FECHA)), "2026-09-11");

  // ----- 17 · TEST 3 — fecha sin hora NO guarda -----
  await pulsarBoton("nuevo");
  await pausa(500);
  await js(elegir("En una fecha"));
  await pausa(350);
  await js(`(() => {
    const f = document.querySelector('input[aria-label="Fecha"]');
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    set.call(f, '2026-09-11');
    f.dispatchEvent(new Event('input', { bubbles: true }));
    f.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
  await pausa(400);
  await pulsarBoton("Guardar");
  comprobar(
    "TEST 3 · fecha sin hora NO guarda",
    await js(ALERTA),
    "Elige la fecha y la hora en las que continuar."
  );

  // ----- 17 · TEST 1 — «Después» guarda con lo que trae de fábrica -----
  await pulsarBoton("nuevo");
  await pausa(500);
  await js(elegir("En una fecha"));
  await pausa(300);
  await js(elegir("Después de un tiempo"));
  await pausa(350);
  await pulsarBoton("Guardar");
  comprobar("TEST 1 · DESPUÉS guarda sin pedir nada", await js(ALERTA), null);
  comprobar("y el nodo resume su espera", await js(GUARDADO), "Esperar 5 minutos");

  // -------------------------------------------------------------------------
  console.log("\nA3 · AUTOAVANCE, y el horario que NO tapa al momento");
  // -------------------------------------------------------------------------
  await pulsarBoton("nuevo");
  await pausa(500);
  await js(elegir("En una fecha"));
  await pausa(400);

  // EL FOCO SE VA SOLO. Se teclea «12» en la hora y el cursor tiene que estar
  // ya en los minutos, sin que nadie haya hecho clic.
  await clic(HORA);
  await seleccionarTodo();
  await teclear("1");
  comprobar("con «1» el foco ESPERA la segunda cifra", await js(FOCO), "Hora");

  await teclear("2");
  await pausa(250);
  comprobar("al completar «12» el foco pasa a los minutos", await js(FOCO), "Minutos");

  // Y se sigue escribiendo sin tocar el ratón.
  await teclear("45");
  await pausa(250);
  comprobar("y se escriben los minutos de corrido", await js(RELOJ), "12 : 45 a. m.");

  await js(pulsarMitad("p. m."));
  await pausa(250);
  comprobar("con la tarde pulsada queda 12 : 45 p. m.", await js(RELOJ), "12 : 45 p. m.");

  await js(`(() => {
    const f = document.querySelector('input[aria-label="Fecha"]');
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    set.call(f, '2026-09-15');
    f.dispatchEvent(new Event('input', { bubbles: true }));
    f.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
  await pausa(400);

  // ----- EL HORARIO SE SUMA, NO SUSTITUYE -----
  await js(conmutar("Solo en horario permitido"));
  await pausa(450);

  comprobar("con el horario ON la fecha SIGUE en pantalla", await js(valor(FECHA)), "2026-09-15");
  comprobar("y la hora SIGUE en pantalla", await js(RELOJ), "12 : 45 p. m.");
  comprobar("y el momento principal se VE, no solo existe", await js(MOMENTO_VISIBLE), true);
  comprobar("el horario no invade el sitio del momento", await js(SIN_SOLAPE), true);

  await js(conmutar("Lunes"));
  await pausa(450);
  comprobar("con un día activo, la fecha sigue ahí", await js(valor(FECHA)), "2026-09-15");
  comprobar("y la hora también", await js(RELOJ), "12 : 45 p. m.");

  await pulsarBoton("Guardar");
  comprobar("FECHA + HORARIO guarda", await js(ALERTA), null);
  comprobar("conservando la fecha", await js(CONFIG_FECHA), "2026-09-15");
  comprobar("conservando la hora en 24 horas", await js(CONFIG_HORA), "12:45");

  await pulsarBoton("reabrir");
  await pausa(500);
  comprobar("al reabrir sigue la fecha", await js(valor(FECHA)), "2026-09-15");
  comprobar("al reabrir sigue la hora", await js(RELOJ), "12 : 45 p. m.");
  comprobar("y el horario sigue encendido", await js(estadoDe("Solo en horario permitido")), "true");
  comprobar("con su día puesto", await js(estadoDe("Lunes")), "true");

  // ----- 17 · DESPUÉS + HORARIO: la espera tampoco se tapa -----
  await pulsarBoton("nuevo");
  await pausa(500);
  await js(conmutar("Solo en horario permitido"));
  await pausa(450);
  comprobar(
    "con DESPUÉS, el horario ON deja ver la espera",
    await js(ESPERA),
    "5"
  );
  comprobar("y la espera se VE entera, sin recortar", await js(MOMENTO_VISIBLE), true);
  comprobar("el horario no invade el sitio de la espera", await js(SIN_SOLAPE), true);

  // CASO D · apagar el horario devuelve la pantalla a su sitio.
  await js(conmutar("Solo en horario permitido"));
  await pausa(450);
  comprobar("apagado, la espera sigue viéndose", await js(MOMENTO_VISIBLE), true);
  comprobar("y los días se retiran", await js(estadoDe("Lunes")), null);
  await js(conmutar("Solo en horario permitido"));
  await pausa(450);

  await js(conmutar("Lunes"));
  await pausa(400);
  await pulsarBoton("Guardar");
  comprobar("TEST 6 · DESPUÉS + HORARIO guarda", await js(ALERTA), null);
  comprobar(
    "y el resumen cuenta LAS DOS COSAS",
    await js(GUARDADO),
    "Esperar 5 minutos + horario permitido"
  );

  // -------------------------------------------------------------------------
  console.log("\nB · EL MOMENTO PRINCIPAL: dos, y solo uno gobierna");
  // -------------------------------------------------------------------------
  await recargar();
  await js(elegir("Después de un tiempo"));
  await pausa(320);
  await pulsarBoton("Guardar");
  comprobar("DESPUÉS guarda sin pedir ninguna fecha", await js(ALERTA), null);
  comprobar("y el nodo resume la espera", await js(GUARDADO), "Esperar 5 minutos");

  await recargar();
  await js(elegir("En una fecha"));
  await pausa(320);
  await pulsarBoton("Guardar");
  comprobar("FECHA guarda sin pedir ninguna espera", await js(ALERTA), null);
  comprobar("y el nodo resume la cita", await js(GUARDADO), "12 sep 2026 · 12:30 p.m.");

  // -------------------------------------------------------------------------
  console.log("\nC · EL HORARIO: opcional, y se SUMA — no sustituye");
  // -------------------------------------------------------------------------
  await recargar();
  await js(elegir("Después de un tiempo"));
  await pausa(320);
  comprobar("el horario nace apagado", await js(estadoDe("Solo en horario permitido")), "false");

  await js(conmutar("Solo en horario permitido"));
  await pausa(320);
  comprobar("encendido, reclama LO SUYO y no una fecha", await (async () => {
    await pulsarBoton("Guardar");
    return js(ALERTA);
  })(), SIN_DIAS);

  await js(conmutar("Lunes"));
  await pausa(320);
  await pulsarBoton("Guardar");
  comprobar("con un día activo, guarda", await js(ALERTA), null);
  comprobar(
    "y el resumen dice LAS DOS COSAS, no solo el horario",
    await js(GUARDADO),
    "Esperar 5 minutos + horario permitido"
  );

  await pulsarBoton("reabrir");
  await js(conmutar("Solo en horario permitido"));
  await pausa(320);
  await pulsarBoton("Guardar");
  comprobar("apagarlo vuelve a dejar guardar sin tocar los días", await js(ALERTA), null);
  comprobar("y el resumen deja de mencionarlo", await js(GUARDADO), "Esperar 5 minutos");

  // -------------------------------------------------------------------------
  console.log("\nD · LA COMBINACIÓN QUE EL MODELO VIEJO HACÍA IMPOSIBLE");
  // -------------------------------------------------------------------------
  // «En una fecha» Y «solo en horario permitido» a la vez. Con tres pestañas
  // excluyentes no había forma de pedir esto: elegir horario cancelaba la cita.
  await recargar();
  await js(elegir("En una fecha"));
  await pausa(320);
  await js(conmutar("Solo en horario permitido"));
  await pausa(320);
  await js(conmutar("Lunes"));
  await pausa(320);
  await pulsarBoton("Guardar");

  comprobar("fecha + horario se pueden guardar juntos", await js(ALERTA), null);
  comprobar(
    "y el nodo cuenta las dos",
    await js(GUARDADO),
    "12 sep 2026 · 12:30 p.m. + horario permitido"
  );
}
