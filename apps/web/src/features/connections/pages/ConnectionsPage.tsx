import "../styles/connections-page.css";

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
    <div className="connections-page">
      <h1 className="connections-page__title">Conexiones</h1>
      <p className="connections-page__desc">
        Administra instancias, estados y conexiones WhatsApp.
      </p>
    </div>
  );
}
