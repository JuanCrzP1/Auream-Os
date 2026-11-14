// ---------------------------------------------------------------------------
// Datos de la conversación para las variables del sistema: quién la atiende y
// por qué número escribe el cliente (`{attendant_name}`, `{instance_name}`,
// `{instance_number}`, con los nombres de Leona). El motor los recibe en
// `RuntimeInput.conversation`; los lee `ConversationFactsReader` una vez por
// turno y solo si el flujo los usa.
// ---------------------------------------------------------------------------

export interface ConversationFacts {
  /** El asesor asignado (su nombre en Mi perfil), o `null` si nadie la tiene. */
  readonly assigneeName: string | null;
  /** El número conectado: su nombre en Conexiones y el número. */
  readonly connectionName: string | null;
  readonly connectionNumber: string | null;
}

/** Las variables que salen de aquí: si un flujo no las nombra, no se consulta nada. */
export const CONVERSATION_FACT_VARIABLES = ["attendant_name", "instance_name", "instance_number"] as const;
