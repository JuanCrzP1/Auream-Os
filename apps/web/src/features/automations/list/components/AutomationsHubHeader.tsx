
/**
 * AutomationsHubHeader — cabecera del hub de automatizaciones.
 *
 * Responsabilidad única: título y subtítulo. La acción de crear vive donde el
 * usuario está mirando los recursos —en la sección de Carpetas cuando ya hay
 * contenido, y en el estado vacío cuando no lo hay—, nunca aquí arriba.
 */
export function AutomationsHubHeader() {
  return (
    <header className="hub-header">
      <div className="hub-header__left">
        <h1 className="hub-header__title">Automatizaciones</h1>
        <p className="hub-header__subtitle">
          Crea y gestiona automatizaciones para simplificar tus procesos.
        </p>
      </div>
    </header>
  );
}
