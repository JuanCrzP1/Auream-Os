import { PagePlaceholder } from "@shared/ui/page-placeholder/PagePlaceholder";

/**
 * Módulos que ya se ven en el menú de la cuenta (para conocerlo completo) pero
 * que llegan más adelante. Cuando uno se construya, su ruta deja de usar esto.
 */

export function TeamComingSoon() {
  return (
    <PagePlaceholder
      title="Equipo"
      description="Invita a tus asesores y administradores, dales permisos por área y mira quién atiende cada chat."
    />
  );
}

export function BillingComingSoon() {
  return (
    <PagePlaceholder
      title="Pagos y suscripciones"
      description="Tu plan, lo que consumes en el mes, tus métodos de pago y tus facturas, en un solo lugar."
    />
  );
}

export function HelpComingSoon() {
  return (
    <PagePlaceholder
      title="Ayuda y soporte"
      description="Guías paso a paso, novedades de Auream y un canal directo para escribirnos."
    />
  );
}

export function DashboardComingSoon() {
  return (
    <PagePlaceholder
      title="Dashboard"
      description="Tus métricas en vivo: conversaciones, flujos que corrieron, contactos nuevos y conversiones del Pixel."
    />
  );
}
