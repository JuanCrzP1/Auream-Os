/** Reloj de arena: distinto del bocadillo de Mensaje y del reloj del Programador. */
export function WaitResponseIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="white" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5.75" y1="2.75" x2="14.25" y2="2.75" />
      <line x1="5.75" y1="17.25" x2="14.25" y2="17.25" />
      <path d="M7.25 2.75v2.4L10 10l2.75-4.85V2.75" />
      <path d="M7.25 17.25v-2.4L10 10l2.75 4.85v2.4" />
    </svg>
  );
}
