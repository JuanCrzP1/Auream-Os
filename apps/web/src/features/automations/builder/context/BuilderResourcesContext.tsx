import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useLabelCatalog } from "@shared/labels/useLabelCatalog";
import { EMPTY_TOOL_RESOURCES, type ToolResources } from "@features/automations/builder/tools/ToolResources";
import { testIntegrationRequest } from "@features/automations/builder/services/testIntegrationRequest";
import { apiErrorMessage } from "@shared/http/apiErrorMessage";
import { useAiCredentials } from "@shared/ai-credentials/useAiCredentials";
import { connectAi, listAiModels, testAiStep } from "@features/automations/builder/services/aiCapabilities";

// ---------------------------------------------------------------------------
// Recursos de la cuenta (datos y capacidades) para los editores de herramientas.
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
  const { create } = catalog;
  const ai = useAiCredentials();
  const { create: createAiCredential } = ai;
  const resources = useMemo<ToolResources>(
    () => ({
      labels: catalog.labels.map(({ name, color }) => ({ name, color })),
      // Crea en el catálogo (el mismo de Contactos → Etiquetas) y lo recarga.
      createLabel: async (input) => {
        try {
          const label = await create(input);
          return { ok: true, label: { name: label.name, color: label.color } };
        } catch (error) {
          return { ok: false, message: apiErrorMessage(error, "No se pudo crear la etiqueta. Inténtalo de nuevo.") };
        }
      },
      testIntegration: testIntegrationRequest,
      aiCredentials: ai.credentials,
      aiCredentialsStatus: ai.status,
      createAiCredential: connectAi(createAiCredential),
      listAiModels,
      testAi: testAiStep
    }),
    [catalog.labels, create, ai.credentials, ai.status, createAiCredential]
  );

  return <BuilderResourcesContext.Provider value={resources}>{children}</BuilderResourcesContext.Provider>;
}

/** Recursos cargados; vacíos fuera del builder (tests, vistas sueltas). */
export function useBuilderResources(): ToolResources {
  return useContext(BuilderResourcesContext);
}
