/**
 * Papelera. Hereda el color de quien la pinta, igual que [[ToolsLayersIcon]].
 *
 * El proyecto no tenía ninguna: los menús del Hub usan caracteres Unicode
 * («✕», «⊟») y los botones de la tarjeta de nodo llevan su SVG en línea. Esta
 * vive en un componente propio para que el segundo sitio que necesite una
 * papelera la importe en lugar de volver a dibujarla.
 *
 * Trazo de 1.5 sobre lienzo de 16, la misma métrica que los iconos de acción
 * del nodo, para que a 12–14px se lean igual de nítidos.
 */
export function TrashIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2.75 4.25h10.5" />
      <path d="M4.75 4.25v8a1.5 1.5 0 0 0 1.5 1.5h3.5a1.5 1.5 0 0 0 1.5-1.5v-8" />
      <path d="M6.5 4.25V3a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v1.25" />
      <path d="M6.75 6.75v4.5" />
      <path d="M9.25 6.75v4.5" />
    </svg>
  );
}
