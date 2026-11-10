import { PagePlaceholder } from "@shared/ui/page-placeholder/PagePlaceholder";

/**
 * Opciones del menú de la cuenta que ya se ven (para conocerlo completo) pero
 * que llegan más adelante. Cuando una se construya, tendrá su módulo propio en
 * `features/` y su ruta dejará de usar esto. Los módulos de la barra lateral
 * ya tienen el suyo (ver `moduleRoutes.tsx`).
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
