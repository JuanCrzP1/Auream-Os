// ---------------------------------------------------------------------------
// PRUEBA DE NAVEGADOR REAL — Programador en SAFARI (WebKit).
//
// POR QUÉ ESTA ES LA QUE IMPORTA. El fallo de la hora se vio aquí: el editor
// segmentado de `<input type="time">` no dejaba seleccionar ni reescribir una
// hora ya guardada. La solución fue retirar ese control, no domarlo — pero
// quien puede confirmar que el reemplazo se comporta en WebKit es WebKit. Esta
// prueba corre EL MISMO escenario que la de Chrome —el de `escenario.mjs`, sin
// una sola aserción propia— en el motor donde el usuario lo vio romperse.
//
// SIN DEPENDENCIAS NUEVAS. macOS trae `/usr/bin/safaridriver`, que habla
// WebDriver del W3C por HTTP; aquí se le habla con `fetch` y nada más. No hay
// Playwright, ni Selenium, ni un `node_modules` que crezca por esto.
//
// PULSACIONES Y CLICS REALES, vía la API de acciones de WebDriver: el driver
// los entrega al motor igual que un teclado. No se llama a `onChange` ni se
// escribe `.value` desde JS — hacerlo se saltaría justo la capa donde vive el
// bug, y daría verde con el fallo puesto.
//
// REQUIERE UNA AUTORIZACIÓN DEL USUARIO, una sola vez y en su propia máquina:
// Safari no acepta automatización sin que su dueño la active a mano. Cuando
// falta, esta prueba NO finge que no puede correr: lo dice, explica el clic que
// falta y sale con código 2 para que se distinga de un fallo real.
// ---------------------------------------------------------------------------

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { crearComprobador, levantarBanco, pausa } from "./banco.mjs";
import { correrEscenario } from "./escenario.mjs";

const AQUI = dirname(fileURLToPath(import.meta.url));
const DIST = join(AQUI, ".dist-safari");
const PUERTO = 8973;
const DRIVER = 4599;

const RAIZ = `http://127.0.0.1:${DRIVER}`;

const COMO_AUTORIZAR = `
  Safari no permite que nadie lo conduzca sin permiso explícito de su dueño.
  Son dos casillas, una sola vez en esta máquina:

    1 · Safari ▸ Ajustes… ▸ Avanzado
        marcar «Mostrar funciones para desarrolladores web»

    2 · Safari ▸ menú Desarrollo (o «Funciones para desarrolladores»)
        marcar «Permitir automatización remota»

  Y después, otra vez:  npm run test:safari
`;

async function peticion(metodo, ruta, cuerpo) {
  const respuesta = await fetch(`${RAIZ}${ruta}`, {
    method: metodo,
    headers: { "Content-Type": "application/json" },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo)
  });
  const datos = await respuesta.json();

  if (datos.value?.error) {
    const error = new Error(datos.value.message ?? datos.value.error);
    error.codigoWebDriver = datos.value.error;
    throw error;
  }
  return datos.value;
}

async function esperarAlDriver() {
  for (let intento = 0; intento < 40; intento += 1) {
    try {
      await fetch(`${RAIZ}/status`);
      return;
    } catch {
      await pausa(250);
    }
  }
  throw new Error("safaridriver no respondió en su puerto");
}

/** El conductor del escenario, hablado en WebDriver. */
async function abrirSesion(url) {
  const sesion = await peticion("POST", "/session", {
    capabilities: { alwaysMatch: { browserName: "safari" } }
  });
  const base = `/session/${sesion.sessionId}`;

  const ir = (destino) => peticion("POST", `${base}/url`, { url: destino });

  const js = async (expresion) =>
    peticion("POST", `${base}/execute/sync`, { script: `return (${expresion});`, args: [] });

  /**
   * Un clic REAL sobre el primer segmento del control.
   *
   * El origen de la acción es el ELEMENTO y sus coordenadas son relativas a su
   * CENTRO —así lo define la especificación—, de modo que para caer sobre el
   * segmento de la hora hay que desplazarse hacia la izquierda. Se calcula con
   * el ancho real medido en la página, no con un número escrito a mano: el
   * control mide lo que el tema diga.
   */
  const clic = async (selector) => {
    const elemento = await peticion("POST", `${base}/element`, {
      using: "css selector",
      value: selector
    });
    const id = Object.values(elemento)[0];
    const ancho = await js(`document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect().width`);
    const desplazamiento = Math.round(18 - ancho / 2);

    await peticion("POST", `${base}/actions`, {
      actions: [
        {
          type: "pointer",
          id: "raton",
          parameters: { pointerType: "mouse" },
          actions: [
            { type: "pointerMove", duration: 0, origin: { ELEMENT: id, "element-6066-11e4-a52e-4f735466cecf": id }, x: desplazamiento, y: 0 },
            { type: "pointerDown", button: 0 },
            { type: "pause", duration: 40 },
            { type: "pointerUp", button: 0 }
          ]
        }
      ]
    });
    await pausa(220);
  };

  /** Una secuencia de teclas cualquiera, entregada por el driver. */
  const teclas = (acciones) =>
    peticion("POST", `${base}/actions`, {
      actions: [{ type: "key", id: "teclado", actions: acciones }]
    });

  // Los códigos que la especificación reserva para las teclas sin glifo.
  const META = "\uE03D";
  const TAB = "\uE004";
  /** Retroceso, en el alfabeto de teclas del W3C. */
  const RETROCESO = "\uE003";

  /**
   * Cmd+A sobre el campo enfocado.
   *
   * ES EL GESTO QUE NO SE PODÍA HACER. El editor segmentado de WebKit no
   * aceptaba seleccionar todo el valor, así que una hora ya guardada no había
   * manera de reescribirla. Con tres campos propios vuelve a ser lo que es en
   * cualquier otro campo del sistema.
   */
  const seleccionarTodo = async () => {
    await teclas([
      { type: "keyDown", value: META },
      { type: "keyDown", value: "a" },
      { type: "keyUp", value: "a" },
      { type: "keyUp", value: META }
    ]);
    await pausa(120);
  };

  const tabular = async () => {
    await teclas([
      { type: "keyDown", value: TAB },
      { type: "keyUp", value: TAB }
    ]);
    await pausa(160);
  };

  /**
   * Borrar lo seleccionado con la tecla de retroceso, de verdad.
   *
   * Vaciar un campo es un GESTO legítimo del control —puede quedarse en blanco
   * mientras se edita— y escribir `.value = ""` desde JS se saltaría justo la
   * capa que decide si esa pulsación entra.
   */
  const borrar = async () => {
    await teclas([
      { type: "keyDown", value: RETROCESO },
      { type: "keyUp", value: RETROCESO }
    ]);
    await pausa(160);
  };

  const teclear = async (texto) => {
    for (const caracter of texto) {
      await teclas([
        { type: "keyDown", value: caracter },
        { type: "keyUp", value: caracter }
      ]);
      await pausa(110);
    }
  };

  const pulsarBoton = async (texto) => {
    await js(
      `[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(texto)})?.click() ?? null`
    );
    await pausa(380);
  };

  /**
   * Espera a que el BANCO diga que ya pintó, en vez de dormir un rato.
   *
   * Mismo motivo que en Chrome, y aquí pesa más: WebKit monta el lienzo a su
   * ritmo y un reloj fijo convertiría «va lento» en «está roto». La prueba
   * tiene que fallar por el producto, nunca por la máquina.
   */
  const esperarBanco = async () => {
    for (let intento = 0; intento < 80; intento += 1) {
      if ((await js(`document.documentElement.getAttribute('data-banco')`)) === "listo") return;
      await pausa(100);
    }
    throw new Error("el banco no llegó a montar");
  };

  const recargar = async () => {
    await ir(url);
    await esperarBanco();
    await pausa(250);
  };

  await ir(url);
  await esperarBanco();
  await pausa(250);

  return {
    js, teclear, clic, seleccionarTodo, tabular, borrar, pulsarBoton, recargar, pausa,
    cerrar: () => peticion("DELETE", base).catch(() => {})
  };
}

async function main() {
  const banco = await levantarBanco({ puerto: PUERTO, dist: DIST });
  const { comprobar, informar } = crearComprobador();

  const driver = spawn("/usr/bin/safaridriver", ["-p", String(DRIVER)], { stdio: "ignore" });

  let sesion;
  let sinAutorizar = false;
  try {
    await esperarAlDriver();
    try {
      sesion = await abrirSesion(banco.url);
    } catch (error) {
      if (/remote automation|Allow remote/i.test(error.message ?? "")) {
        sinAutorizar = true;
      } else {
        throw error;
      }
    }

    if (!sinAutorizar) await correrEscenario(sesion, comprobar);
  } finally {
    await sesion?.cerrar();
    driver.kill();
    await banco.cerrar();
  }

  if (sinAutorizar) {
    console.log(`\nSAFARI: NO EJECUTADO — falta autorizar la automatización.\n${COMO_AUTORIZAR}`);
    process.exit(2);
  }

  informar("Safari");
}

await main();
