// ---------------------------------------------------------------------------
// Las salidas de un Distribuidor: forma y operaciones.
//
// POR QUÉ NO VIVE EN `contracts/`
//
// `WaitResponseConfig` subió a `contracts/` porque su forma la leen las dos
// orillas: el editor la escribe y `QuestionNodeHandler` la ejecuta. Aquí no
// ocurre: `DistributorNodeHandler` declara `distributor_executor_not_implemented`
// y no abre la configuración. Mientras la forma no cruce al motor se queda en la
// carpeta de la herramienta, igual que `readMessageConfig` — que tampoco sube
// porque `MessageNodeHandler` solo mira `content.text`. El día que el motor
// aprenda a repartir, este archivo sube entero y sin cambios de forma.
//
// PURO: sin React, sin lienzo, sin React Flow. Recibe datos y devuelve datos.
// Todo lo que aquí se decide se puede probar sin montar una pantalla.
// ---------------------------------------------------------------------------

/**
 * Una salida del reparto.
 *
 * `id` ES IDENTIDAD, NO ROTULO. Viaja como `sourceHandle` en la arista del
 * lienzo y se guarda como `fromOutput` en el snapshot, así que renumerarlo o
 * reaprovecharlo movería conexiones ya hechas a otro sitio. Se genera una vez,
 * al crear la salida, y no vuelve a tocarse: borrar la primera de tres deja a
 * las otras dos con el id que ya tenían y con sus conexiones intactas.
 *
 * `label` es lo único que el usuario lee. Se guarda en lugar de derivarse de la
 * posición justamente por lo de arriba: si se calculara como «Salida n.º
 * posición», borrar una renombraría a todas las siguientes y el rótulo dejaría
 * de corresponder con el punto al que alguien ya había conectado algo.
 */
export interface DistributorOutput {
  readonly id: string;
  readonly label: string;
}

/**
 * Lo que el usuario configura en un Distribuidor.
 *
 * Solo las salidas, y es deliberado. La política de reparto —turnos, peso,
 * fijar un contacto a una salida— no está decidida en el producto ni existe en
 * el motor, así que no se modela: un campo que nadie ejecuta es una promesa
 * escrita en disco. Cuando la política se decida, se añade aquí y el editor la
 * ofrece; hasta entonces esta herramienta declara exactamente lo que sabe
 * hacer, que es nombrar por dónde puede salir la conversación.
 */
export interface DistributorConfig {
  readonly outputs: ReadonlyArray<DistributorOutput>;
}

/** Un Distribuidor nace SIN salidas. El usuario las crea; no se le regala una. */
export const DISTRIBUTOR_DEFAULT_CONFIG: DistributorConfig = { outputs: [] };

/**
 * Identidad utilizable de una salida, o `null` si lo que llega no lo es.
 *
 * VIVE AQUÍ PORQUE LA NECESITAN DOS. El lector la usa para decidir qué salida
 * puede pintarse y la validación para decidir qué configuración puede
 * guardarse: son dos preguntas distintas sobre la MISMA regla —qué cuenta como
 * identidad—, y escribirla en cada sitio era tenerla dos veces. Con la regla
 * repetida, endurecerla en un lado dejaba al otro aceptando lo que el primero
 * ya rechazaba, y esa divergencia no la habría señalado nada.
 *
 * Mismo recurso que `resolveContextKey` en el contrato de Esperar respuesta,
 * que también comparten su lector y su validación.
 */
export function normalizarIdDeSalida(valor: unknown): string | null {
  if (typeof valor !== "string") return null;

  const limpio = valor.trim();
  return limpio.length > 0 ? limpio : null;
}

/**
 * Contador de identidades del módulo.
 *
 * Mismo recurso que `nextItemId` en Mensaje —marca de tiempo en base 36 más una
 * secuencia— y por la misma razón: dos salidas creadas en el mismo milisegundo
 * necesitan ids distintos, y `Date.now()` a solas no lo garantiza.
 */
let secuencia = 0;

function siguienteId(): string {
  secuencia += 1;
  return `ds-${Date.now().toString(36)}-${secuencia}`;
}

/** Número que lleva un rótulo con la forma «Salida n», o `null` si no la tiene. */
function numeroDelRotulo(label: string): number | null {
  const encontrado = /^Salida\s+(\d+)$/.exec(label.trim());
  if (encontrado === null) return null;

  const numero = Number(encontrado[1]);
  return Number.isSafeInteger(numero) ? numero : null;
}

/**
 * Rótulo que le toca a la próxima salida.
 *
 * CUENTA DESDE EL MAYOR, no desde el total. Con «Salida 1, 2, 3», borrar la
 * primera y añadir otra por longitud daría un segundo «Salida 3»: dos filas con
 * el mismo nombre y dos puntos de conexión que el usuario no puede distinguir.
 * Tomando el mayor existente sale «Salida 4», que además es honesto — esa salida
 * es nueva, no la reencarnación de la que se borró.
 *
 * Los rótulos que no siguen la forma «Salida n» simplemente no cuentan: no
 * estorban y no hay razón para renombrarlos.
 */
export function siguienteRotulo(outputs: ReadonlyArray<DistributorOutput>): string {
  const mayor = outputs.reduce((alto, salida) => {
    const numero = numeroDelRotulo(salida.label);
    return numero !== null && numero > alto ? numero : alto;
  }, 0);

  return `Salida ${mayor + 1}`;
}

/**
 * Una salida nueva, ya nombrada y con identidad propia.
 *
 * No se exporta: la forma de crear una salida es `anadirSalida`, que además la
 * coloca. Una fábrica suelta al lado de la única operación que la usa sería
 * superficie pública sin caso de uso — y dos maneras de hacer lo mismo.
 */
function crearSalida(outputs: ReadonlyArray<DistributorOutput>): DistributorOutput {
  return { id: siguienteId(), label: siguienteRotulo(outputs) };
}

/** Añade una salida al final. Devuelve una lista nueva; no muta la recibida. */
export function anadirSalida(
  outputs: ReadonlyArray<DistributorOutput>
): DistributorOutput[] {
  return [...outputs, crearSalida(outputs)];
}

/**
 * Quita la salida indicada.
 *
 * Por `id` y nunca por posición: es lo que garantiza que se borre la que el
 * usuario señaló aunque la lista se haya reordenado entre el render y el clic.
 * Un `id` que no está deja la lista igual, sin fallar: borrar lo que ya no está
 * es un gesto sin consecuencias, no un error.
 */
export function quitarSalida(
  outputs: ReadonlyArray<DistributorOutput>,
  id: string
): DistributorOutput[] {
  return outputs.filter((salida) => salida.id !== id);
}
