import { createContext, useContext } from "react";
import type { ToolCapabilities } from "../../ToolResources";

/**
 * La capacidad de subir archivos, del editor del Mensaje a cada zona de
 * archivo (que está varios niveles más abajo). Contexto LOCAL de la
 * herramienta: llega de `resources` por props; aquí solo se reparte.
 */
const MediaUploadContext = createContext<ToolCapabilities["uploadMedia"]>(undefined);

export const MediaUploadProvider = MediaUploadContext.Provider;

export function useMediaUpload(): ToolCapabilities["uploadMedia"] {
  return useContext(MediaUploadContext);
}
