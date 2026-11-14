import type { ToolData } from "../ToolDefinition";
import { SET_FIELD_OPERATION_SIGN, readSetFieldConfig } from "./setFieldConfig";

/** «{cancion_video} = {cancion_2}» · «{reintentos} + 1». */
export function summarizeSetField(_content: ToolData, config: ToolData): string {
  const read = readSetFieldConfig(config);
  if (!read.field) return "Sin dato elegido";
  const value = read.value.trim() || "…";
  return read.operation === "set" ? `{${read.field}} = ${value}` : `{${read.field}} ${SET_FIELD_OPERATION_SIGN[read.operation]} ${value}`;
}
