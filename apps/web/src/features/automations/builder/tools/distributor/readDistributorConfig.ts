import { normalizarIdDeSalida, type DistributorOutput } from "./distributorOutputs";

// ---------------------------------------------------------------------------
// Lectura de las salidas desde un nodo.
//
// DESCONFIADO A PROPÓSITO, igual que `readMessageItems` y
// `readWaitResponseConfig`. Lo que llega es JSON de disco o de red: pudo
// escribirlo una versión anterior de la herramienta, una edición a mano o un
// flujo importado. Un campo corrupto no puede tumbar el editor ni el lienzo; se
// descarta lo ilegible y se sigue con lo que sí se entiende.
//
// NO INVENTA NADA. Un Distribuidor sin salidas legibles se lee como un
// Distribuidor sin salidas —que es un estado válido: así nace—, nunca como uno
// con una salida de cortesía que el usuario no creó.
// ---------------------------------------------------------------------------

/** Estrecha una salida suelta, o la descarta si no es representable. */
function toSalida(raw: unknown, index: number): DistributorOutput | null {
  if (typeof raw !== "object" || raw === null) return null;

  const record = raw as Record<string, unknown>;

  // SIN ID NO HAY SALIDA RECUPERABLE, y aquí sí se descarta —al contrario que
  // en Mensaje, que le inventa uno por posición—. La diferencia es qué
  // significa el id en cada sitio: en Mensaje ordena bloques dentro del nodo,
  // aquí ES el punto de conexión al que apuntan las aristas guardadas.
  // Fabricar uno por posición inventaría un destino que ninguna arista conoce y
  // dejaría un punto colgando en el lienzo.
  //
  // Qué cuenta como identidad lo decide el dominio, no este archivo: la misma
  // regla la aplica `validateDistributor` para decidir si puede guardarse.
  const id = normalizarIdDeSalida(record.id);
  if (id === null) return null;

  // El rótulo sí es recuperable: es texto para leer, no identidad. Uno perdido
  // se repone por posición antes que tirar una salida con conexiones vivas.
  const label = typeof record.label === "string" ? record.label.trim() : "";

  return { id, label: label.length > 0 ? label : `Salida ${index + 1}` };
}

/**
 * Salidas configuradas en un nodo Distribuidor.
 *
 * IDS ÚNICOS GARANTIZADOS. Dos salidas con el mismo id producirían dos `Handle`
 * de React Flow con la misma identidad: una arista guardada contra ese id ya no
 * sabría a cuál de las dos vuelve. Se conserva la primera aparición y se
 * descarta la repetida, que es la única lectura que deja el lienzo coherente.
 * Que el dato llegara así lo señala aparte `validateDistributor`, que mira el
 * crudo y sí tiene voz para decirlo.
 */
export function readDistributorOutputs(
  config: Readonly<Record<string, unknown>>
): DistributorOutput[] {
  const raw = config.outputs;
  if (!Array.isArray(raw)) return [];

  const vistos = new Set<string>();

  return raw
    .map(toSalida)
    .filter((salida): salida is DistributorOutput => {
      if (salida === null || vistos.has(salida.id)) return false;
      vistos.add(salida.id);
      return true;
    });
}
