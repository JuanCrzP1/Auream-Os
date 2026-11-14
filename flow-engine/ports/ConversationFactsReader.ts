import type { ConversationFacts } from "../../contracts/ConversationFacts";

/**
 * Quién atiende la conversación y por qué número escribe el cliente
 * (`{attendant_name}`, `{instance_name}`, `{instance_number}`). Lo cumple la
 * composición (SQL en producción, datos de ejemplo en el laboratorio).
 * `null`: no se sabe; las variables quedan vacías.
 */
export interface ConversationFactsReader {
  facts(tenantId: string, conversationKey: string): Promise<ConversationFacts | null>;
}
