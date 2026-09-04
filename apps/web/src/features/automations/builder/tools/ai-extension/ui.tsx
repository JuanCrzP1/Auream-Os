import type { ToolUi } from "../ToolUi";
import { AiExtensionIcon } from "./AiExtensionIcon";

/**
 * Mitad React de la herramienta. Único punto donde declara cómo se ve.
 *
 * `card` y no `circle`: aunque Extensión IA actúa contra un servicio externo,
 * lo que produce es contenido, y su configuración —prompt, modelo, variables de
 * contexto autorizadas— pedirá una vista previa en reposo que un círculo no
 * puede sostener. Queda en la misma clase que Mensaje y Esperar respuesta.
 *
 * Esta asignación no venía en el reparto aprobado: se decide aquí y se señala
 * para revisión.
 */
export const aiExtensionUi: ToolUi = {
  type: "ai",
  Icon: AiExtensionIcon,
  frame: "card"
};
