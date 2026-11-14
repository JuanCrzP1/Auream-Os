import { VALID, invalid, type BlockData, type BlockCheck } from "../BlockRules";
import { SET_FIELD_KEY_PATTERN, isProtectedField, readSetFieldConfig } from "../../SetFieldConfig";

export const MISSING_FIELD_MESSAGE = "Elige el dato que se guarda.";
export const INVALID_FIELD_MESSAGE = "El nombre del dato solo admite letras sin tildes, números, «_», «-» y «.».";
export const PROTECTED_FIELD_MESSAGE = "Ese dato no se cambia desde un flujo: los Datos del negocio se cambian en Configuración y los demás los llena Auream.";
export const MISSING_VALUE_MESSAGE = "Escribe el valor que se guarda (puede llevar variables, como {cancion_2}).";
export const MISSING_OPERAND_MESSAGE = "Escribe el número con el que se hace la cuenta (o una variable con un número).";

/** ¿Puede guardarse? Que tenga el dato, que no sea uno protegido y que tenga valor. */
export function validateSetField(_content: BlockData, config: BlockData): BlockCheck {
  const read = readSetFieldConfig(config);
  if (!read.field) return invalid(MISSING_FIELD_MESSAGE);
  if (!SET_FIELD_KEY_PATTERN.test(read.field)) return invalid(INVALID_FIELD_MESSAGE);
  if (isProtectedField(read.field)) return invalid(PROTECTED_FIELD_MESSAGE);
  if (read.value.trim().length === 0) return invalid(read.operation === "set" ? MISSING_VALUE_MESSAGE : MISSING_OPERAND_MESSAGE);
  return VALID;
}
