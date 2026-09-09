/**
 * Icono de la herramienta Esperar respuesta.
 *
 * RELOJ DE ARENA, y no un bocadillo. Llevaba EXACTAMENTE el mismo contorno de
 * bocadillo que `MessageIcon` —la misma `path` carácter por carácter— y solo se
 * diferenciaba en lo de dentro: tres puntos en vez de dos líneas. A los 18px de
 * la cabecera de un nodo y a los 20 de la paleta esa diferencia no se ve, así
 * que las dos herramientas se leían como la misma cosa en el sitio donde el
 * usuario tiene que elegir entre ellas.
 *
 * Tampoco es un reloj: ese silueta ya la ocupa Intervalo (círculo con agujas), y
 * repetirla habría movido el problema de una herramienta a otra. El reloj de
 * arena no lo usa ninguna de las trece, dice «esto tarda» de un vistazo y es el
 * mismo signo que la herramienta ya declara como `glyph: "⏳"`.
 *
 * `stroke="white"` como las otras trece: el icono se pinta siempre sobre el
 * color de la herramienta —paleta, cabecera del nodo y cabecera del editor—, y
 * los tres son fondos ámbar saturado.
 */
export function WaitResponseIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="white" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      {/* Tapas: lo que da la silueta reconocible a cualquier tamaño. */}
      <line x1="5.75" y1="2.75" x2="14.25" y2="2.75" />
      <line x1="5.75" y1="17.25" x2="14.25" y2="17.25" />
      {/* Los dos embudos, unidos en el cuello. */}
      <path d="M7.25 2.75v2.4L10 10l2.75-4.85V2.75" />
      <path d="M7.25 17.25v-2.4L10 10l2.75 4.85v2.4" />
    </svg>
  );
}
