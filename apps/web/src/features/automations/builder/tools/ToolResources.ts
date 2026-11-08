// ---------------------------------------------------------------------------
// Recursos de la cuenta que un editor puede OFRECER al configurar (etiquetas,
// y mañana integraciones, píxeles, credenciales de IA…).
//
// Llegan por props, ya cargados: una herramienta nunca llama a la API. Quien
// los carga es el builder (`BuilderResourcesProvider`), una vez por pantalla.
// Son sugerencias, no validación: un flujo puede nombrar algo que aún no existe
// (el motor crea las etiquetas que falten).
// ---------------------------------------------------------------------------

/** Etiqueta del catálogo de la cuenta, tal como la ofrece un editor. */
export interface ToolLabelOption {
  readonly name: string;
  readonly color: string;
}

export interface ToolResources {
  readonly labels: ReadonlyArray<ToolLabelOption>;
}

export const EMPTY_TOOL_RESOURCES: ToolResources = { labels: [] };
