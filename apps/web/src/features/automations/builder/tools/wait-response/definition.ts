import { WAIT_RESPONSE_DEFAULT_CONFIG } from "@contracts/WaitResponseConfig";
import type { ToolDefinition } from "../ToolDefinition";
import { summarizeWaitResponse } from "./summarizeWaitResponse";
import { validateWaitResponse } from "./validateWaitResponse";

/**
 * Esperar respuesta — suspende el flujo hasta que el cliente contesta.
 *
 * Guarda además la respuesta en el contexto de la sesión si el nodo declara
 * `config.targetKey`. Esa capacidad venía del retirado nodo `capture`: una
 * pregunta que no recuerda lo que le contestaron no sirve aguas abajo.
 *
 * Exige un edge de fallback (`isFallback`), que valida `validateFallbacks` en
 * el backend. El fallback es una propiedad del edge, no una herramienta.
 *
 * NO DECLARA `duplicateConfig` NI `releaseResources`, y no por olvido: su
 * configuración son datos planos sin identidades internas —la copia profunda
 * genérica la reproduce bien— y no reserva nada fuera de ella. Los dos ganchos
 * existen para herramientas que sí lo necesitan, como Mensaje con sus archivos.
 */
export const waitResponseTool: ToolDefinition = {
  summarize: summarizeWaitResponse,
  validateContent: validateWaitResponse,
  type: "question",
  label: "Esperar respuesta",
  description: "Aguarda input del usuario",
  defaultContentText: "Pregunta esperando input",
  // Nace SIN mensaje previo: el texto es opcional —puede haberlo preguntado un
  // nodo anterior— y un contenido inventado obligaría a borrarlo para conseguir
  // el caso más común. `defaultContentText` sigue sirviendo de rótulo del nodo.
  defaultContent: {},
  editorTitle: "Editar espera",
  availableInPalette: true,
  terminal: false,
  executable: true,
  // La forma mínima válida la declara el contrato compartido, que es el mismo
  // que lee el motor: así el nodo nace con exactamente lo que el handler sabe
  // ejecutar, sin una segunda declaración que pueda divergir.
  defaultConfig: { ...WAIT_RESPONSE_DEFAULT_CONFIG },
  // ÁMBAR. Identidad propia de la herramienta, en el mismo formato en que las
  // otras trece declaran la suya: color de cabecera, cuerpo y degradado de la
  // paleta. El editor repite estos tonos en `--wr-amber`.
  colors: {
    header: "#f59e0b",
    body: "#b45309",
    gradient: "linear-gradient(135deg,#fbbf24,#b45309)"
  },
  glyph: "⏳"
};
