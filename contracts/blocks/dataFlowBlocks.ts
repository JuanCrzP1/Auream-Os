import { GO_TO_FLOW_DEFAULT_CONFIG, readGoToFlowConfig } from "../GoToFlowConfig";
import { SET_FIELD_DEFAULT_CONFIG, readSetFieldConfig } from "../SetFieldConfig";
import type { BlockData, BlockRules } from "./BlockRules";
import { validateGoToFlow } from "./validation/goToFlow";
import { validateSetField } from "./validation/setField";

// ---------------------------------------------------------------------------
// Los bloques que mueven datos y conversaciones sin hablar con el cliente
// (2026-11-14, para pasar los flujos de Leona): «Guardar dato» (su
// Manipulador) e «Ir a otro flujo» (su Conexión de flujo). Viven aparte del
// catálogo para que cada archivo siga siendo corto; `blockCatalog.ts` los suma.
// ---------------------------------------------------------------------------

const data = (value: object): BlockData => value as BlockData;

/** Guardar dato: pone un valor en un dato o hace una cuenta con él. Salida única. */
export const SET_FIELD_BLOCK: BlockRules = {
  type: "set-field",
  label: "Guardar dato",
  defaultContent: {},
  defaultConfig: data(SET_FIELD_DEFAULT_CONFIG),
  availableInPalette: true,
  terminal: false,
  validate: validateSetField,
  normalizeConfig: (config) => data(readSetFieldConfig(config))
};

/** Ir a otro flujo: el cliente sigue en otro flujo. Sin salidas: la conversación sigue allá. */
export const GO_TO_FLOW_BLOCK: BlockRules = {
  type: "go-to-flow",
  label: "Ir a otro flujo",
  defaultContent: {},
  defaultConfig: data(GO_TO_FLOW_DEFAULT_CONFIG),
  availableInPalette: true,
  terminal: true,
  outputs: () => [],
  validate: validateGoToFlow,
  normalizeConfig: (config) => data(readGoToFlowConfig(config))
};
