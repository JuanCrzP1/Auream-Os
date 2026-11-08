import type { IntegrationTestRequest, IntegrationTestResult } from "@contracts/IntegrationTestContracts";

// ---------------------------------------------------------------------------
// Lo que un editor puede usar de la cuenta al configurar:
//
//   · DATOS para ofrecer (el catálogo de etiquetas; mañana píxeles,
//     credenciales de IA…).
//   · CAPACIDADES puntuales (crear una etiqueta, probar una integración).
//
// Llegan por props, ya preparados: una herramienta nunca llama a la API ni
// conoce el contexto que los carga (`BuilderResourcesProvider`). Las
// capacidades no lanzan: devuelven un resultado o un mensaje para mostrar.
// Los datos son sugerencias, no validación: un flujo puede nombrar algo que
// aún no existe (el motor crea las etiquetas que falten).
// ---------------------------------------------------------------------------

/** Etiqueta del catálogo de la cuenta, tal como la ofrece un editor. */
export interface ToolLabelOption {
  readonly name: string;
  readonly color: string;
}

export type IntegrationTestOutcome =
  | { readonly ok: true; readonly result: IntegrationTestResult }
  | { readonly ok: false; readonly message: string };

export type CreateLabelOutcome =
  | { readonly ok: true; readonly label: ToolLabelOption }
  | { readonly ok: false; readonly message: string };

export interface ToolCapabilities {
  /** Crea una etiqueta en el catálogo de la cuenta (queda para todos los flujos). */
  readonly createLabel?: (input: { readonly name: string; readonly color: string }) => Promise<CreateLabelOutcome>;
  /** Envía una vez la petición de un bloque Integración y devuelve la respuesta. */
  readonly testIntegration?: (request: IntegrationTestRequest) => Promise<IntegrationTestOutcome>;
}

export interface ToolResources extends ToolCapabilities {
  readonly labels: ReadonlyArray<ToolLabelOption>;
}

export const EMPTY_TOOL_RESOURCES: ToolResources = { labels: [] };
