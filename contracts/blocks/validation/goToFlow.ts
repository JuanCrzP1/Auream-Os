import { VALID, invalid, type BlockData, type BlockCheck } from "../BlockRules";
import { readGoToFlowConfig } from "../../GoToFlowConfig";

export const MISSING_FLOW_MESSAGE = "Elige el flujo al que pasa el cliente.";

/** Que el flujo exista, no sea este y esté activo lo revisan el editor (con la lista) y el motor (al saltar). */
export function validateGoToFlow(_content: BlockData, config: BlockData): BlockCheck {
  return readGoToFlowConfig(config).flowId ? VALID : invalid(MISSING_FLOW_MESSAGE);
}
