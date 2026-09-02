import { AutomationSearchBar } from "./AutomationSearchBar";

interface AutomationsToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  onCreateFolder: () => void;
}

/**
 * AutomationsToolbar — barra de herramientas del hub.
 *
 * Responsabilidad única: controles de filtrado y acciones sobre la lista.
 * Presentacional: recibe la acción de crear carpeta por props y no sabe qué
 * ocurre al pulsarla —ni API, ni diálogo, ni persistencia—.
 *
 * Sólo se monta en el estado con contenido, así que es el sitio natural de
 * "Nueva carpeta" cuando el empty state ya no está: la acción sigue existiendo
 * en ambos estados sin aparecer dos veces a la vez.
 *
 * Preparada para añadir filtros por status (Todos/Activos/Borradores/Archivados)
 * y toggle de vista (cuadrícula/tabla) sin modificar la página.
 */
export function AutomationsToolbar({ search, onSearchChange, onCreateFolder }: AutomationsToolbarProps) {
  return (
    <div className="hub-toolbar">
      <AutomationSearchBar value={search} onChange={onSearchChange} />
      <div className="hub-toolbar__actions">
        <button type="button" className="hub-toolbar__btn" onClick={onCreateFolder}>
          Nueva carpeta
        </button>
      </div>
    </div>
  );
}
