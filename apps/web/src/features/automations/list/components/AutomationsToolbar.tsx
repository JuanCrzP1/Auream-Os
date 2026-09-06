import { AutomationSearchBar } from "./AutomationSearchBar";

interface AutomationsToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  onCreateFolder: () => void;
  onCreateFlow: () => void;
}

/**
 * AutomationsToolbar — barra de herramientas del hub.
 *
 * Responsabilidad única: controles de filtrado y acciones sobre la lista.
 * Presentacional: recibe la acción de crear carpeta por props y no sabe qué
 * ocurre al pulsarla —ni API, ni diálogo, ni persistencia—.
 *
 * Sólo se monta en el estado con contenido, así que es el sitio natural de las
 * dos acciones de creación cuando el empty state ya no está: siguen existiendo
 * en ambos estados sin aparecer dos veces a la vez.
 *
 * Las dos van juntas en la misma fila del buscador, y en este orden: primero
 * crear una automatización, que es la acción principal del hub, y después
 * crear una carpeta, que solo sirve para ordenarlas. `hub-toolbar__actions` ya
 * era una fila flexible, así que no hace falta maquetación nueva.
 *
 * Preparada para añadir filtros por status (Todos/Activos/Borradores/Archivados)
 * y toggle de vista (cuadrícula/tabla) sin modificar la página.
 */
export function AutomationsToolbar({
  search,
  onSearchChange,
  onCreateFolder,
  onCreateFlow
}: AutomationsToolbarProps) {
  return (
    <div className="hub-toolbar">
      <AutomationSearchBar value={search} onChange={onSearchChange} />
      <div className="hub-toolbar__actions">
        <button type="button" className="hub-toolbar__new-btn" onClick={onCreateFlow}>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Nueva
        </button>
        <button type="button" className="hub-toolbar__btn" onClick={onCreateFolder}>
          Nueva carpeta
        </button>
      </div>
    </div>
  );
}
