// ---------------------------------------------------------------------------
// PRUEBA DE NAVEGADOR REAL — Programador en CHROME (Blink).
//
// POR QUÉ EXISTE. El bug que la motiva —no poder cambiar la hora— pasó por
// delante de toda la suite sin que un solo test se pusiera rojo. No fue mala
// suerte: `fireEvent.change` escribe el valor completo de una vez, y un control
// de fecha u hora se compone por SEGMENTOS, informando `""` hasta que están
// todos. Ese `""` intermedio, que es el que rompe el campo, jsdom no lo emite
// nunca. Ninguna prueba en jsdom podía encontrarlo, y por eso hay una aquí.
//
// QUÉ PRUEBA HOY. El campo de hora ya no es `<input type="time">`: es una caja
// de texto propia. Eso cambia lo que este archivo significa — antes comprobaba
// el comportamiento de un control del navegador, que en Blink nunca falló;
// ahora comprueba código nuestro, el mismo en todos los motores. Su verde vale
// bastante más que antes, pero sigue sin ser la palabra final: quien responde
// por WebKit es `programador.safari.mjs`, que corre ESTE MISMO escenario.
//
// SIN DEPENDENCIAS NUEVAS. Node trae `WebSocket` global, así que habla el
// protocolo de DevTools directamente. No se añadió Playwright, Cypress ni
// Selenium para esto.
//
// NO ESTÁ EN `vitest run`, y es deliberado: necesita Chrome instalado y un
// puerto libre. Se ejecuta aparte con `npm run test:browser`, de modo que la
// suite de siempre sigue siendo rápida y sin requisitos de entorno.
//
// TECLEA DE VERDAD: `Input.dispatchKeyEvent` entrega pulsaciones al motor, no
// llama a `onChange` ni toca el estado de React. Es la única forma de que la
// prueba pase por el mismo camino que el usuario.
// ---------------------------------------------------------------------------

import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { crearComprobador, levantarBanco, pausa } from "./banco.mjs";
import { correrEscenario } from "./escenario.mjs";

const AQUI = dirname(fileURLToPath(import.meta.url));
const DIST = join(AQUI, ".dist");
const PUERTO = 8971;
const CDP = 9333;
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

async function localizarPagina() {
  for (let intento = 0; intento < 40; intento += 1) {
    try {
      const objetivos = await (await fetch(`http://localhost:${CDP}/json/list`)).json();
      const pagina = objetivos.find((t) => t.type === "page" && t.url.includes(String(PUERTO)));
      if (pagina) return pagina.webSocketDebuggerUrl;
    } catch {
      /* Chrome todavía no levantó su puerto. */
    }
    await pausa(250);
  }
  throw new Error("Chrome no expuso la página en el puerto de depuración");
}

/** El conductor del escenario, hablado en protocolo de DevTools. */
async function abrirSesion(url) {
  const ws = new WebSocket(url);
  let id = 0;
  const pendientes = new Map();
  ws.onmessage = (evento) => {
    const mensaje = JSON.parse(evento.data);
    if (mensaje.id && pendientes.has(mensaje.id)) {
      pendientes.get(mensaje.id)(mensaje.result);
      pendientes.delete(mensaje.id);
    }
  };
  await new Promise((r) => (ws.onopen = r));

  // CON PLAZO. Una orden que no vuelve dejaba la prueba colgada para siempre y
  // sin decir en qué paso: `await` sobre una promesa que nadie resuelve no da
  // ni un error. Ahora se rinde y dice cuál fue.
  const enviar = (method, params = {}) =>
    new Promise((resolver, rechazar) => {
      const i = (id += 1);
      const plazo = setTimeout(() => {
        pendientes.delete(i);
        rechazar(new Error(`Chrome no respondió a ${method} en 20s`));
      }, 20_000);

      pendientes.set(i, (resultado) => {
        clearTimeout(plazo);
        resolver(resultado);
      });
      ws.send(JSON.stringify({ id: i, method, params }));
    });

  const js = async (expresion) =>
    (await enviar("Runtime.evaluate", { expression: expresion, returnByValue: true })).result?.value;

  /**
   * El «seleccionar todo» DEL SISTEMA sobre el campo enfocado.
   *
   * `commands: ["selectAll"]` entrega la orden de edición nativa —la misma que
   * dispara Cmd+A— en vez de simular la combinación de teclas y confiar en que
   * el navegador la interprete. Es el gesto que el control nativo de hora no
   * aceptaba y por el que una hora ya puesta no se podía reescribir.
   */
  const seleccionarTodo = async () => {
    await enviar("Input.dispatchKeyEvent", {
      type: "keyDown",
      key: "a",
      code: "KeyA",
      modifiers: 4,
      windowsVirtualKeyCode: 65,
      nativeVirtualKeyCode: 65,
      commands: ["selectAll"]
    });
    await enviar("Input.dispatchKeyEvent", {
      type: "keyUp", key: "a", code: "KeyA", modifiers: 4,
      windowsVirtualKeyCode: 65, nativeVirtualKeyCode: 65
    });
    await pausa(120);
  };

  /**
   * Borrar lo seleccionado con la tecla de retroceso, de verdad.
   *
   * Hace falta porque vaciar un campo es un GESTO legítimo del control —se
   * puede quedar en blanco mientras se edita— y escribir `.value = ""` desde JS
   * se saltaría justo la capa que decide si esa pulsación entra.
   */
  const borrar = async () => {
    for (const type of ["keyDown", "keyUp"]) {
      await enviar("Input.dispatchKeyEvent", {
        type, key: "Backspace", code: "Backspace",
        windowsVirtualKeyCode: 8, nativeVirtualKeyCode: 8
      });
    }
    await pausa(160);
  };

  /** Salir del campo con el tabulador, que es como se confirma escribiendo. */
  const tabular = async () => {
    for (const type of ["keyDown", "keyUp"]) {
      await enviar("Input.dispatchKeyEvent", {
        type, key: "Tab", code: "Tab",
        windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9
      });
    }
    await pausa(160);
  };

  const teclear = async (texto) => {
    for (const caracter of texto) {
      for (const type of ["keyDown", "keyUp"]) {
        await enviar("Input.dispatchKeyEvent", {
          type,
          text: type === "keyDown" ? caracter : undefined,
          key: caracter,
          windowsVirtualKeyCode: caracter.toUpperCase().charCodeAt(0),
          nativeVirtualKeyCode: caracter.toUpperCase().charCodeAt(0)
        });
      }
      await pausa(90);
    }
  };

  const clic = async (selector) => {
    const caja = JSON.parse(
      await js(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();
        return JSON.stringify({x:r.x+18,y:r.y+r.height/2})})()`)
    );
    for (const type of ["mousePressed", "mouseReleased"]) {
      await enviar("Input.dispatchMouseEvent", {
        type, x: caja.x, y: caja.y, button: "left", clickCount: 1
      });
    }
    await pausa(220);
  };

  const pulsarBoton = async (texto) => {
    await js(
      `[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(texto)})?.click()`
    );
    await pausa(380);
  };

  /**
   * Espera a que el BANCO diga que ya pintó, en vez de dormir un rato.
   *
   * El banco monta el lienzo real de React Flow y tarda lo que tarda la
   * máquina. Dormir «lo suficiente» es justo como se cuelan rojos que no son
   * del producto: la prueba preguntaba por el editor antes de que existiera y
   * daba por roto lo que solo iba lento.
   */
  const esperarBanco = async () => {
    for (let intento = 0; intento < 80; intento += 1) {
      if ((await js(`document.documentElement.getAttribute('data-banco')`)) === "listo") return;
      await pausa(100);
    }
    throw new Error("el banco no llegó a montar");
  };

  const recargar = async () => {
    await js(`document.documentElement.removeAttribute('data-banco')`);
    await js("location.reload()");
    await esperarBanco();
    await pausa(250);
  };

  await enviar("Runtime.enable");
  return {
    js, teclear, clic, seleccionarTodo, tabular, borrar, pulsarBoton, recargar, pausa,
    esperarBanco,
    cerrar: () => ws.close()
  };
}

async function main() {
  const banco = await levantarBanco({ puerto: PUERTO, dist: DIST });
  const { comprobar, informar } = crearComprobador();

  // UN CHROME LIMPIO, Y NO EL DEL USUARIO.
  //
  // Sin `--user-data-dir` propio, Chrome abría el perfil real de la máquina:
  // arrancaban sus extensiones —cada una con su proceso—, la carga se iba a
  // minutos y el resultado dependía de qué tuviera instalado quien ejecutara la
  // prueba. Un perfil temporal, borrado al terminar, la vuelve reproducible.
  //
  // EL IDIOMA NO SE DA POR SUPUESTO. `--lang` se pide, pero el renderer puede
  // acabar con el del sistema igualmente, y de eso depende si el control de
  // hora es de 12 o de 24 horas. El escenario lo detecta y se adapta en vez de
  // confiar en este parámetro.
  const perfil = await mkdtemp(join(tmpdir(), "programador-chrome-"));
  const chrome = spawn(
    CHROME,
    [
      "--headless=new", "--disable-gpu", "--no-sandbox", "--lang=en-US",
      `--user-data-dir=${perfil}`,
      "--disable-extensions", "--no-first-run", "--no-default-browser-check",
      "--disable-background-networking", "--disable-sync",
      "--window-size=1200,900",
      `--remote-debugging-port=${CDP}`, banco.url
    ],
    { stdio: "ignore" }
  );

  let sesion;
  try {
    sesion = await abrirSesion(await localizarPagina());
    await sesion.esperarBanco();
    await pausa(250);
    await correrEscenario(sesion, comprobar);
  } finally {
    sesion?.cerrar();
    chrome.kill();
    await banco.cerrar();
    await rm(perfil, { recursive: true, force: true });
  }

  informar("Chrome");
}

await main();
