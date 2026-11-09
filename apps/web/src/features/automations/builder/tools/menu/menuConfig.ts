
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

export { menuOutputs } from "@contracts/blocks/outputs";
