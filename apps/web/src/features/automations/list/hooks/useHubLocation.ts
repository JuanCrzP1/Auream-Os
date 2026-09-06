import { useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";

/**
 * useHubLocation — dónde está el usuario dentro del hub, y cómo moverse.
 *
 * LA UBICACIÓN VIVE EN LA RUTA, no en un estado del componente. Es lo que hace
 * que recargar dentro de una carpeta siga dentro de ella, que el botón atrás
 * del navegador funcione y que un enlace a una carpeta se pueda compartir. Un
 * `useState` habría dado lo mismo en pantalla y nada de eso.
 *
 * Se apoya en el enrutado que el producto ya usa —`/automations` y sus rutas
 * hermanas—, sin inventar una segunda navegación.
 *
 * Responsabilidad única: leer la ubicación y ofrecer los dos movimientos. No
 * sabe qué hay dentro de una carpeta; eso lo decide `selectHubContents`.
 */
export function useHubLocation() {
  const navigate = useNavigate();
  const { folderId } = useParams<{ folderId: string }>();

  const openFolder = useCallback(
    (id: string) => navigate(`/automations/folders/${encodeURIComponent(id)}`),
    [navigate]
  );

  const goToRoot = useCallback(() => navigate("/automations"), [navigate]);

  return { folderId: folderId ?? null, openFolder, goToRoot };
}
