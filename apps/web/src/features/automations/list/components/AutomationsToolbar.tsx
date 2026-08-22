import { AutomationSearchBar } from "./AutomationSearchBar";

interface AutomationsToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
}

/**
 * AutomationsToolbar — barra de herramientas del hub.
 *
 * Responsabilidad única: controles de filtrado y búsqueda.
 * Preparada para añadir filtros por status (Todos/Activos/Borradores/Archivados)
 * y toggle de vista (cuadrícula/tabla) sin modificar la página.
 */
export function AutomationsToolbar({ search, onSearchChange }: AutomationsToolbarProps) {
  return (
    <div className="hub-toolbar">
      <AutomationSearchBar value={search} onChange={onSearchChange} />
    </div>
  );
}
