// ---------------------------------------------------------------------------
// Qué se está arrastrando, y de quién.
//
// El navegador solo transporta texto entre el origen y el destino de un
// arrastre, así que hace falta acordar qué texto es. Este módulo ES ese
// acuerdo, y vive aparte por dos razones:
//
//   NI LA TARJETA NI LA CARPETA DEBEN SABERLO. Una escribe y la otra lee; si
//   cada una llevara su propia idea del formato, cambiar el payload obligaría
//   a tocar las dos y a acertar en las dos.
//
//   UN ARRASTRE AJENO NO ES UN DESTINO VÁLIDO. Sobre una carpeta se puede
//   soltar un archivo del escritorio, un enlace o una selección de texto. Sin
//   un tipo propio, la carpeta trataría cualquier cosa como si fuera un flujo.
//
// SE MUEVE UN IDENTIFICADOR, NO UN NOMBRE. Lo que viaja es el id del flujo:
// estable, único y lo que el servidor entiende. El texto de la tarjeta puede
// repetirse entre dos automatizaciones y cambia cuando el usuario renombra.
// ---------------------------------------------------------------------------

/** Tipo propio del arrastre. Lo que no lo lleve, no es un flujo. */
const TIPO = "application/x-auream-flow";

/** Anuncia que lo que se arrastra es este flujo. */
export function escribirFlujoArrastrado(transferencia: DataTransfer, flowId: string): void {
  transferencia.setData(TIPO, flowId);
  transferencia.effectAllowed = "move";
}

/**
 * El flujo que trae un arrastre, o `null` si no trae ninguno.
 *
 * `null` es la respuesta para todo lo demás —un archivo, un enlace, texto—, y
 * quien pregunte debe tratarlo como «esto no es para mí» en vez de intentar
 * adivinar.
 */
export function leerFlujoArrastrado(transferencia: DataTransfer): string | null {
  const id = transferencia.getData(TIPO).trim();
  return id.length > 0 ? id : null;
}

/**
 * `true` si el arrastre que pasa por encima transporta un flujo.
 *
 * Durante `dragover` el navegador NO deja leer los datos —solo los tipos—, así
 * que el destino no puede saber QUÉ flujo es hasta que se suelta. Para decidir
 * si se ilumina basta con saber que hay uno.
 */
export function arrastraUnFlujo(transferencia: DataTransfer): boolean {
  return [...transferencia.types].includes(TIPO);
}
