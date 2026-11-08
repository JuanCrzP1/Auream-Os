import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useLabelCatalog } from "@shared/labels/useLabelCatalog";
import { EMPTY_TOOL_RESOURCES, type ToolResources } from "@features/automations/builder/tools/ToolResources";

// ---------------------------------------------------------------------------
// Recursos de la cuenta para los editores de herramientas.
//
// El builder los carga UNA vez al abrirse y los publica aquí; el marco del
// nodo abierto los pasa al editor por props. Así las herramientas siguen sin
// tocar la API ni conocer este contexto.
//
// Igual que `BuilderEditingContext`, no es un store: es solo lectura y su
// dueño es el hook que carga cada recurso.
// ---------------------------------------------------------------------------

const BuilderResourcesContext = createContext<ToolResources>(EMPTY_TOOL_RESOURCES);

export function BuilderResourcesProvider({ children }: { readonly children: ReactNode }) {
  const catalog = useLabelCatalog();
  const resources = useMemo<ToolResources>(
    () => ({ labels: catalog.labels.map(({ name, color }) => ({ name, color })) }),
    [catalog.labels]
  );

  return <BuilderResourcesContext.Provider value={resources}>{children}</BuilderResourcesContext.Provider>;
}

/** Recursos cargados; vacíos fuera del builder (tests, vistas sueltas). */
export function useBuilderResources(): ToolResources {
  return useContext(BuilderResourcesContext);
}
