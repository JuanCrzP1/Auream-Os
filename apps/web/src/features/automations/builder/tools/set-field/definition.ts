import { SET_FIELD_BLOCK } from "@contracts/blocks/blockCatalog";
import type { ToolDefinition } from "../ToolDefinition";
import { summarizeSetField } from "./summarizeSetField";

/**
 * Guardar dato (el Manipulador de Leona) — pone un valor en un dato del
 * cliente o de la conversación (fijo o con variables), o hace una cuenta con
 * el número que ya tiene (sumar, restar, multiplicar, dividir). Si es un Campo
 * del cliente, queda en su ficha. Lo ejecuta `SetFieldNodeHandler`.
 */
export const setFieldTool: ToolDefinition = {
  ...SET_FIELD_BLOCK,
  description: "Guarda o cambia un dato del cliente",
  defaultContentText: "Dato guardado",
  editorTitle: "Editar guardar dato",
  executable: true,
  summarize: summarizeSetField,
  colors: {
    header: "#774488",
    body: "#4a2955",
    gradient: "linear-gradient(135deg,#9b5fb0,#4a2955)"
  },
  glyph: "✎"
};
