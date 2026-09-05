import { readFileSync } from "node:fs";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// El CSS del LIENZO, como texto.
//
// Hermano de `messageCss`, y existe por lo mismo: jsdom no maqueta, así que una
// prueba que midiera píxeles aquí mediría cero y pasaría siempre. Lo que sí
// puede comprobarse es que la REGLA siga declarando el mecanismo del que
// depende el comportamiento —el recorte de una fila, el acento único, que el
// lienzo no dependa de tokens de una herramienta—.
//
// Es un módulo aparte y no una opción de `messageCss` porque son dos hojas de
// dos capas distintas: la del constructor y la de una herramienta. Mezclarlas
// dejaría a una prueba del lienzo buscando una regla en el CSS de Mensaje.
//
// LO QUE APORTA es que la prueba pregunte por la HOJA DEL LIENZO y no por una
// ruta: mover el archivo dejaba de romper ocho pruebas para no romper ninguna.
// ---------------------------------------------------------------------------

/** Ruta desde la raíz de `apps/web`, que es donde arranca vitest. */
const RAIZ = "src/features/automations/builder/components/canvas";

/** La hoja del nodo del lienzo. */
export const flowNodeCss = readFileSync(join(RAIZ, "flow-node.css"), "utf8");

/** La hoja del marco de un nodo abierto. */
export const nodeExpandedCss = readFileSync(join(RAIZ, "node-expanded.css"), "utf8");
