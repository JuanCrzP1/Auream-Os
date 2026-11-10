import { PagePlaceholder } from "@shared/ui/page-placeholder/PagePlaceholder";

/**
 * DashboardPage — la página de Dashboard. Hoy cuenta lo que traerá; cuando el
 * módulo se construya, esta página es su punto de entrada (ver el README del
 * módulo y `docs/architecture/modules.md`).
 */
export function DashboardPage() {
  return (
    <PagePlaceholder
      title="Dashboard"
      description="Cómo va tu negocio en vivo: ventas, facturación, conversaciones y tasa de cierre, por producto, número y anuncio; con Meta conectado, también el gasto y el ROAS."
    />
  );
}
