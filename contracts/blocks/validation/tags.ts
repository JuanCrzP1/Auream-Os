import { VALID, invalid, type BlockData, type BlockCheck } from "../BlockRules";
import { readTagsConfig } from "../../TagsConfig";

export const NO_TAGS_MESSAGE = "Elige al menos una etiqueta.";

export function validateTags(_content: BlockData, config: BlockData): BlockCheck {
  return readTagsConfig(config).tags.length > 0 ? VALID : invalid(NO_TAGS_MESSAGE);
}
