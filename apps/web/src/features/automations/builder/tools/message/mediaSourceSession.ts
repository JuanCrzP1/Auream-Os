// ---------------------------------------------------------------------------
// Archivos adjuntados en ESTA sesión, indexados por id de bloque.
//
// Un `File` no es serializable: no cabe en `config.items` ni en el autoguardado,
// y un componente no es buen dueño (el editor se desmonta y no es antepasado
// del nodo cerrado). Esto es un almacén observable en memoria: no persiste,
// no es fuente de verdad de la configuración y muere al recargar.
//
// Fase C: `FileSource` subirá el archivo y escribirá `url`; desde entonces
// `url` gana y este registro deja de consultarse para ese bloque.
// ---------------------------------------------------------------------------

interface AttachedFile {
  readonly file: File;
  /** Enlace temporal para pintarlo. Se revoca al reemplazar o liberar. */
  readonly objectUrl: string;
}

const attached = new Map<string, AttachedFile>();
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

/** Suscripción para `useSyncExternalStore`. */
export function subscribeToSession(listener: () => void): () => void {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

/** Adjunta un archivo (liberando el anterior del bloque) y devuelve su enlace. */
export function attachFile(itemId: string, file: File): string {
  releaseFile(itemId);

  const objectUrl = URL.createObjectURL(file);
  attached.set(itemId, { file, objectUrl });
  notify();

  return objectUrl;
}

/** Libera el archivo de un bloque y revoca su enlace. Idempotente. */
export function releaseFile(itemId: string): void {
  const previous = attached.get(itemId);
  if (!previous) return;

  URL.revokeObjectURL(previous.objectUrl);
  attached.delete(itemId);
  notify();
}

/** Enlace para pintar, o `null` si no hay bytes en esta sesión («lo tuve» ≠ «lo tengo»). */
export function sessionObjectUrl(itemId: string): string | null {
  return attached.get(itemId)?.objectUrl ?? null;
}

/** El archivo en sí, para el futuro adaptador de subida. */
export function sessionFile(itemId: string): File | null {
  return attached.get(itemId)?.file ?? null;
}

/**
 * Hechos de la sesión (enlace y tipo declarado) para quien deba reconciliar,
 * p. ej. la caché de miniaturas. La sesión no conoce a sus consumidores.
 */
export function sessionSources(): ReadonlyArray<{ readonly url: string; readonly type: string }> {
  return [...attached.values()].map(({ objectUrl, file }) => ({ url: objectUrl, type: file.type }));
}
