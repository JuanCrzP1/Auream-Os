// ---------------------------------------------------------------------------
// Copia profunda de `content` y `config` de un nodo.
//
// El editor de una herramienta construye su configuración y se la entrega al
// mutador. Sin copia, el nodo y el editor comparten el mismo objeto: mutar uno
// muta el otro a espaldas de React, que no ve el cambio y no vuelve a pintar.
// Con configuración anidada —una lista de opciones, un objeto de ajustes— una
// copia superficial no basta: los hijos seguirían compartidos.
//
// Se clona serializando. No es un atajo: `content` y `config` viajan por HTTP y
// se persisten con `JSON.stringify`, así que lo que no sobrevive a este viaje
// tampoco sobreviviría al guardado. Clonar así hace que el estado en memoria
// sea exactamente lo que se va a guardar, y que un valor no serializable falle
// al escribirlo y no horas después, al recargar.
// ---------------------------------------------------------------------------

/** Copia profunda de un valor serializable. */
export function clonePlainData<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
