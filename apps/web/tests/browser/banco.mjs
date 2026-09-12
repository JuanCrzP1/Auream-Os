// ---------------------------------------------------------------------------
// EL BANCO: empaqueta el Programador real y lo sirve por HTTP.
//
// Lo comparten los dos runners —Chrome y Safari— porque los dos tienen que
// cargar EXACTAMENTE el mismo bundle. Construirlo dos veces con dos configs
// abriría la puerta a que un motor probara un código y el otro, otro.
//
// SIN DEPENDENCIAS NUEVAS: `node:http` para servir y el `vite` que el proyecto
// ya usa para empaquetar.
// ---------------------------------------------------------------------------

import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { readFile, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, extname, join } from "node:path";

const AQUI = dirname(fileURLToPath(import.meta.url));
const WEB = join(AQUI, "..", "..");

const TIPOS = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };

export const pausa = (ms) => new Promise((r) => setTimeout(r, ms));

export function ejecutar(comando, args, opciones) {
  return new Promise((resolver, rechazar) => {
    const proceso = spawn(comando, args, { ...opciones, stdio: "inherit" });
    proceso.on("exit", (codigo) =>
      codigo === 0 ? resolver() : rechazar(new Error(`${comando} salió con ${codigo}`))
    );
  });
}

/**
 * Construye el banco y lo deja servido en `puerto`.
 *
 * Devuelve `{ url, cerrar }`. `cerrar` apaga el servidor y borra el bundle: un
 * runner que muera a mitad no deja ni un puerto ocupado ni una carpeta suelta.
 */
export async function levantarBanco({ puerto, dist }) {
  console.log("\nEmpaquetando el banco de pruebas con el código real…");
  await ejecutar(
    "npx",
    [
      "vite", "build",
      "--config", "tests/browser/harness/vite.config.mjs",
      "--outDir", dist,
      "--emptyOutDir",
      "--logLevel", "error"
    ],
    { cwd: WEB }
  );

  const servidor = createServer(async (peticion, respuesta) => {
    const ruta = peticion.url === "/" ? "/index.html" : peticion.url.split("?")[0];
    try {
      const cuerpo = await readFile(join(dist, ruta));
      respuesta.writeHead(200, {
        "Content-Type": TIPOS[extname(ruta)] ?? "application/octet-stream"
      });
      respuesta.end(cuerpo);
    } catch {
      respuesta.writeHead(404).end();
    }
  });
  await new Promise((r) => servidor.listen(puerto, r));

  return {
    url: `http://localhost:${puerto}/`,
    cerrar: async () => {
      await new Promise((r) => servidor.close(r));
      await rm(dist, { recursive: true, force: true });
    }
  };
}

/** Acumula fallos sin cortar la ejecución: un runner informa de TODOS. */
export function crearComprobador() {
  const fallos = [];

  const comprobar = (descripcion, real, esperado) => {
    const ok = JSON.stringify(real) === JSON.stringify(esperado);
    if (!ok) {
      fallos.push(
        `${descripcion}\n      esperado: ${JSON.stringify(esperado)}\n      real:     ${JSON.stringify(real)}`
      );
    }
    console.log(`  ${ok ? "✓" : "✗"} ${descripcion}`);
  };

  const informar = (motor) => {
    if (fallos.length > 0) {
      console.log(`\n${fallos.length} comprobación(es) fallida(s) en ${motor}:\n\n  · ${fallos.join("\n\n  · ")}\n`);
      process.exit(1);
    }
    console.log(`\nTodo correcto en ${motor} real.\n`);
  };

  return { comprobar, informar };
}
