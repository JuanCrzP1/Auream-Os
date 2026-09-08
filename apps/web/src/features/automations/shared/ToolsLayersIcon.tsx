/**
 * El SVG de capas que identifica Herramientas en la paleta del Builder.
 *
 * HEREDA EL COLOR de quien lo pinta. Llevaba `stroke="white"` fijo, que era la
 * única fuente de estilo dentro del propio SVG: obligaba a que todo contexto lo
 * quisiera blanco, ignoraba el tema y desentonaba en el pie de una tarjeta,
 * donde el resto del texto es `--muted`. Con `currentColor`, el color lo decide
 * el sitio donde se usa —el botón de la paleta lo pide blanco sobre su
 * degradado; la tarjeta lo deja en el gris del pie— y el icono sigue siendo uno
 * solo.
 */
export function ToolsLayersIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 2L2 7l10 5 10-5-10-5z"/>
      <path d="M2 17l10 5 10-5"/>
      <path d="M2 12l10 5 10-5"/>
    </svg>
  );
}
