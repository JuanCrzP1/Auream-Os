import "./page-placeholder.css";

interface Props {
  readonly title: string;
  readonly description: string;
}

/**
 * Pantalla anunciada pero todavía no construida.
 *
 * Responsabilidad única: presentar un módulo pendiente con el lenguaje visual
 * de la plataforma. No conoce rutas, permisos ni datos.
 *
 * Existe porque cada módulo por construir repetía la misma composición: hasta
 * ahora, dos features tenían hojas de estilo idénticas salvo el prefijo de
 * clase y dos rutas resolvían lo mismo con estilos en línea. Cada pantalla
 * nueva habría añadido una copia más.
 *
 * Cuando un módulo se implemente de verdad, deja de usar este componente: no
 * es un layout de página, es un marcador de ausencia.
 */
export function PagePlaceholder({ title, description }: Props) {
  return (
    <section className="page-placeholder">
      <span className="page-placeholder__badge">Próximamente</span>
      <h1 className="page-placeholder__title">{title}</h1>
      <p className="page-placeholder__description">{description}</p>
    </section>
  );
}
