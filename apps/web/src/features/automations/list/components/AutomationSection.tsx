import type { ReactNode } from "react";

interface AutomationSectionProps {
  title: string;
  children: ReactNode;
  gridClass?: string;
}

/**
 * AutomationSection — sección genérica del hub con título y grid.
 *
 * Responsabilidad única: wrapper visual de sección.
 * El tipo de grid se controla por prop para permitir grids distintos
 * (flows vs carpetas) sin duplicar markup.
 */
export function AutomationSection({ title, children, gridClass = "hub-grid" }: AutomationSectionProps) {
  return (
    <section className="hub-section">
      <h2 className="hub-section__title">{title}</h2>
      <div className={gridClass}>{children}</div>
    </section>
  );
}
