// ---------------------------------------------------------------------------
// Worker — entrypoint.
//
// Estado: NO IMPLEMENTADO. Este proceso todavía no procesa nada.
//
// Cuando exista `infrastructure/queue`, el worker será responsable de reanudar
// las sesiones en estado `delayed` y de reintentar entregas fallidas. Hoy no
// hay cola, así que un flow que llega a un nodo de tipo `delay` queda detenido
// y nada lo retoma.
//
// No se anuncian capacidades que no existen: arrancar este proceso no habilita
// delays ni reintentos.
// ---------------------------------------------------------------------------

console.warn(
  "[worker] NO IMPLEMENTADO: no hay cola configurada. Este proceso no reanuda delays ni reintenta entregas."
);
