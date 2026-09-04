import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// El CSS del módulo Mensaje, como texto.
//
// POR QUÉ EXISTE
//
// jsdom no maqueta: una prueba que midiera píxeles aquí mediría cero y pasaría
// siempre. Lo que sí puede comprobarse es que la REGLA siga declarando el
// mecanismo del que depende el comportamiento —un suelo en renglones, un tope
// que corta el crecimiento, la retirada del ancho mínimo intrínseco de un
// `<textarea>`—. Para eso hay que leer el CSS de verdad.
//
// Lo que este helper añade es que la prueba pregunta por el MÓDULO, no por un
// archivo: lee el entrypoint y, si existen, todos los módulos de `styles/`.
// Así una reorganización de la hoja no rompe ninguna prueba, que es justo lo
// que ocurría cuando cada bloque de tests abría `message-editor.css` por su
// ruta literal.
//
// El orden de concatenación NO importa: aquí no se evalúa cascada, se localiza
// la declaración de un selector, y cada selector vive en un único módulo.
// ---------------------------------------------------------------------------

/** Ruta desde la raíz de `apps/web`, que es donde arranca vitest. */
const RAIZ = "src/features/automations/builder/tools/message";
const MODULOS = join(RAIZ, "styles");

function leerModulo(): string {
  const partes = [readFileSync(join(RAIZ, "message-editor.css"), "utf8")];

  if (existsSync(MODULOS)) {
    for (const archivo of readdirSync(MODULOS).sort()) {
      if (archivo.endsWith(".css")) {
        partes.push(readFileSync(join(MODULOS, archivo), "utf8"));
      }
    }
  }

  return partes.join("\n");
}

const css = leerModulo();

/** Salto de línea. Se declara aparte para que el ancla se lea sin ruido. */
const SALTO = "\n";

/**
 * El cuerpo de la regla de `selector`, tal y como está escrito.
 *
 * SE ANCLA A PRINCIPIO DE LÍNEA, y no es un detalle: buscar `${selector} {`
 * como subcadena suelta encuentra también la regla de un DESCENDIENTE que
 * termine igual. `.message-item--interval .message-item__body {` contiene
 * `.message-item__body {`, así que una búsqueda libre devolvía la densidad de
 * Intervalo cuando se pedía el cuerpo del bloque. En un solo archivo eso no
 * se notaba porque la regla buena aparecía antes; al repartir el módulo en
 * varios archivos el orden de lectura dejó de garantizarlo. Toda regla de
 * este módulo empieza en la columna 0, así que el ancla es exacta.
 *
 * Falla si el selector no aparece: durante una reorganización de la hoja, un
 * selector que se pierde tiene que dar un error que lo diga, no un texto vacío
 * contra el que las comprobaciones fallarían sin explicar por qué.
 */
export function bloqueCss(selector: string): string {
  const inicio = css.startsWith(`${selector} {`)
    ? 0
    : css.indexOf(SALTO + selector + " {");
  const desde = inicio === 0 ? 0 : inicio + 1;

  if (inicio === -1) {
    throw new Error(
      `No existe la regla \`${selector}\` en el CSS del módulo Mensaje ` +
        `(${RAIZ}/message-editor.css + ${MODULOS}/*.css).`
    );
  }

  return css.slice(desde, css.indexOf("}", desde));
}
