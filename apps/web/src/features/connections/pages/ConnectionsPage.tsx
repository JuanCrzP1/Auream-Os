import { PagePlaceholder } from "@shared/ui/page-placeholder/PagePlaceholder";

/**
 * ConnectionsPage — placeholder del módulo de conexiones.
 *
 * Bounded context: instancias WhatsApp, QR, sesiones, estados,
 * slots, límites, reconexión, providers, triggers por conexión.
 *
 * TODO: implementar lista de instancias, estado de conexión, QR viewer.
 */
export function ConnectionsPage() {
  return (
    <PagePlaceholder
      title="Conexiones"
      description="Administra instancias, estados y conexiones WhatsApp."
    />
  );
}
