// La forma de la configuración es el contrato compartido con el motor
// (`contracts/SetFieldConfig.ts`): el dato, qué se hace y el valor.
export {
  SET_FIELD_DEFAULT_CONFIG,
  SET_FIELD_LIMITS,
  SET_FIELD_OPERATIONS,
  SET_FIELD_OPERATION_LABEL,
  SET_FIELD_OPERATION_SIGN,
  isProtectedField,
  readSetFieldConfig,
  type SetFieldConfig,
  type SetFieldOperation
} from "@contracts/SetFieldConfig";
