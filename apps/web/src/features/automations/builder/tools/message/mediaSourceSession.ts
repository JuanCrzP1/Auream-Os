// ---------------------------------------------------------------------------
// Los archivos que el usuario ha adjuntado en ESTA sesión.
//
// POR QUÉ EXISTE
//
// Un medio tiene dos fuentes posibles y son de naturaleza distinta:
//
//   ENLACE   es un dato. Viaja en `config.items`, se guarda y sobrevive a todo.
//   ARCHIVO  es un objeto del navegador. NO es serializable, así que no puede
//            entrar en la configuración ni en el autoguardado.
//
// Lo segundo necesita un sitio donde vivir, y ese sitio no puede ser un
// componente: `FileSource` se desmonta al cerrar el editor —la referencia
// moriría aunque la pestaña siga abierta— y además no es antepasado del nodo
// cerrado, así que el preview del lienzo nunca podría verla. Ese era el defecto:
// el archivo existía y nadie fuera del editor abierto podía saberlo.
//
// Esto es la mesa auxiliar de la sesión, no un almacén: guarda lo que el
// navegador ya tiene en memoria y lo pone al alcance de quien lo necesite
// pintar. Muere al recargar, como el propio `File`.
//
// LO QUE NO ES, y por eso no contradice nada de lo acordado: no persiste, no
// escribe en disco, no toca `localStorage`, no es una segunda fuente de verdad
// de la configuración —esa sigue siendo `config.items`— y no guarda estado de
// interfaz. Solo mapea la identidad de un bloque con el archivo que se le
// adjuntó.
//
// SE INDEXA POR EL ID DEL BLOQUE, que es estable y ya existe para que el
// reordenamiento no pierda el foco. No hace falta inventar ninguna clave.
//
// CAMINO A LA FASE C: cuando exista almacenamiento, `FileSource` llamará al
// adaptador y escribirá el enlace devuelto en `config.items[n].url`. A partir
// de ese momento este registro deja de consultarse para ese bloque, porque
// `url` gana. Ni la validación ni el preview cambian: los dos ya preguntan
// primero por el enlace.
// ---------------------------------------------------------------------------

interface ArchivoAdjunto {
  /** El objeto del navegador. Vive mientras viva la pestaña. */
  readonly file: File;
  /** Enlace temporal para poder pintarlo. Se revoca al reemplazar o soltar. */
  readonly objectUrl: string;
}

const adjuntos = new Map<string, ArchivoAdjunto>();

/** Quien quiera enterarse de que la sesión ha cambiado. */
const suscriptores = new Set<() => void>();

function avisar(): void {
  for (const suscriptor of suscriptores) suscriptor();
}

/**
 * Avisa cuando se adjunta o se suelta un archivo.
 *
 * ESTO ES LO QUE FALTABA, y era un defecto real: este registro se leía durante
 * el render pero no tenía forma de decir que había cambiado. El nodo cerrado se
 * montaba sin archivo, preguntaba una vez, y nadie volvía a avisarle nunca —así
 * que se quedaba con el icono mientras el archivo ya estaba aquí—. Medido: el
 * fotograma listo a los 836ms y el nodo aún con el icono a los 5200ms.
 *
 * Es la mitad que convierte este mapa en un almacén observable, que es lo que
 * `useSyncExternalStore` necesita para mantener a React al día.
 */
export function alCambiarLaSesion(suscriptor: () => void): () => void {
  suscriptores.add(suscriptor);
  return () => void suscriptores.delete(suscriptor);
}

/**
 * Adjunta un archivo a un bloque y devuelve el enlace con el que pintarlo.
 *
 * Suelta el anterior del mismo bloque antes de crear el nuevo: sin eso, cambiar
 * de archivo cinco veces dejaría cinco archivos retenidos en memoria.
 */
export function adjuntarArchivo(itemId: string, file: File): string {
  soltarArchivo(itemId);

  const objectUrl = URL.createObjectURL(file);
  adjuntos.set(itemId, { file, objectUrl });

  avisar();

  return objectUrl;
}

/** Suelta el archivo de un bloque y revoca su enlace. Idempotente. */
export function soltarArchivo(itemId: string): void {
  const previo = adjuntos.get(itemId);
  if (!previo) return;

  // El enlace muere aquí. Quien haya derivado algo de él —una miniatura, por
  // ejemplo— se entera por `alCambiarLaSesion`: este registro no sabe quiénes
  // son ni qué guardaron.
  URL.revokeObjectURL(previo.objectUrl);
  adjuntos.delete(itemId);

  avisar();
}

/**
 * Enlace con el que pintar el archivo adjunto, si sigue disponible.
 *
 * `null` significa exactamente una cosa: en esta sesión no hay bytes para ese
 * bloque. Puede ser porque nunca se adjuntó nada o porque la página se recargó.
 * Quien lo consulte debe representar ese caso con honestidad en vez de inventar
 * una imagen — es la diferencia entre «lo tengo» y «lo tuve».
 */
export function enlaceDeSesion(itemId: string): string | null {
  return adjuntos.get(itemId)?.objectUrl ?? null;
}

/** El archivo en sí. Lo necesitará el adaptador de subida en la Fase C. */
export function archivoDeSesion(itemId: string): File | null {
  return adjuntos.get(itemId)?.file ?? null;
}

/**
 * Todo lo que la sesión tiene ahora mismo, para quien necesite reconciliar.
 *
 * Se devuelve el enlace y el TIPO DECLARADO POR EL ARCHIVO, y nada más: este
 * registro no sabe qué es una miniatura ni para qué sirve un video. Quien
 * derive algo de estos enlaces decide qué hacer cuando uno desaparece.
 *
 * Ese es el sentido de la dirección: la sesión ofrece hechos, los subsistemas
 * que dependen de ella los interpretan. Antes era al revés —la sesión llamaba a
 * la generación de miniaturas— y eso obligaba a tocarla cada vez que apareciera
 * un consumidor nuevo.
 */
export function fuentesDeSesion(): ReadonlyArray<{ readonly enlace: string; readonly tipo: string }> {
  return [...adjuntos.values()].map(({ objectUrl, file }) => ({
    enlace: objectUrl,
    tipo: file.type
  }));
}
