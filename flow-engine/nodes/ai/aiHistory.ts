import type { AiMessage } from "../../ports/AiGateway";

// ---------------------------------------------------------------------------
// Memoria de la conversación de UN bloque de IA, guardada en la sesión (no en
// el contacto): se olvida al terminar la conversación. Puro.
// ---------------------------------------------------------------------------

export function historyKey(nodeId: string): string {
  return `__ai.${nodeId}.history`;
}

export function readHistory(context: Readonly<Record<string, unknown>>, nodeId: string): AiMessage[] {
  const raw = context[historyKey(nodeId)];
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (entry): entry is AiMessage =>
      typeof entry === "object" && entry !== null && (entry.role === "user" || entry.role === "assistant") && typeof entry.content === "string"
  );
}

/** Añade un intercambio y conserva solo los últimos `turns` (pregunta + respuesta). */
export function appendHistory(history: ReadonlyArray<AiMessage>, user: string, assistant: string, turns: number): AiMessage[] {
  return [...history, { role: "user" as const, content: user }, { role: "assistant" as const, content: assistant }].slice(-turns * 2);
}
