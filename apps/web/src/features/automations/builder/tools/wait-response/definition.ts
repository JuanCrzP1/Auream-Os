import type { ToolDefinition } from "../ToolDefinition";

/**
 * Esperar respuesta — suspende el flujo hasta que el usuario contesta.
 *
 * Guarda además la respuesta en el contexto de la sesión si el nodo declara
 * `config.targetKey`. Esa capacidad venía del retirado nodo `capture`: una
 * pregunta que no recuerda lo que le contestaron no sirve aguas abajo.
 *
 * Exige un edge de fallback (`isFallback`), que valida `validateFallbacks` en
 * el backend. El fallback es una propiedad del edge, no una herramienta.
 */
export const waitResponseTool: ToolDefinition = {
  type: "question",
  label: "Esperar respuesta",
  description: "Aguarda input del usuario",
  defaultContentText: "Pregunta esperando input",
  editorTitle: "Editar pregunta",
  availableInPalette: true,
  terminal: false,
  executable: true,
  defaultConfig: {},
  colors: {
    header: "#ea580c",
    body: "#c2410c",
    gradient: "linear-gradient(135deg,#f97316,#c2410c)"
  },
  glyph: "⏳"
};
