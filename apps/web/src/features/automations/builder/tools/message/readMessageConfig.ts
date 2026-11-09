import type { ToolData } from "../ToolDefinition";
import { readMessageItems as readItems } from "@contracts/MessageConfig";
import type { MessageItem } from "./types";

// Lectura defensiva de la secuencia: es la del contrato compartido con el motor
// (`contracts/MessageConfig.ts`), incluida la compatibilidad con `content.text`.

/** Bloques legibles. Lista vacía es válida (nodo recién creado o vaciado). */
export function readMessageItems(config: ToolData, content: ToolData): MessageItem[] {
  return readItems(config, content);
}
