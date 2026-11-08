import type { ToolData, ToolOutput } from "../ToolDefinition";
import { MENU_OUTPUT, readMenuConfig } from "@contracts/MenuConfig";

// La forma de los datos es el contrato compartido con el motor
// (`contracts/MenuConfig.ts`). Aquí: las salidas que pinta el lienzo.
export {
  MENU_DEFAULT_CONFIG,
  MENU_LIMITS,
  MENU_OUTPUT,
  readMenuConfig,
  type MenuConfig,
  type MenuFormat,
  type MenuOption,
  type MenuTimeUnit
} from "@contracts/MenuConfig";

export function menuOutputs(config: ToolData): ReadonlyArray<ToolOutput> {
  const read = readMenuConfig(config);

  return [
    ...read.options.map((option, index) => ({ id: option.id, label: option.title.trim() || `Opción ${index + 1}` })),
    { id: MENU_OUTPUT.other, label: "Otra respuesta" },
    ...(read.timeoutEnabled ? [{ id: MENU_OUTPUT.timeout, label: "Tiempo agotado" }] : [])
  ];
}
