import type { ContactFieldSync } from "../../../domains/contact-fields/application/ContactFieldSync";
import type { TurnFields } from "../../../domains/messaging/application/FlowTurn";
import { identityOf, type ContactDirectory } from "../../../flow-engine/ports/ContactDirectory";

/**
 * El turno de un flujo → Campos del cliente: lo que guardaron los bloques y
 * es un campo definido pasa al cliente del chat, con el flujo de origen. El
 * cliente se busca solo si hay algo que guardar.
 */
export function contactFieldTurns(sync: Pick<ContactFieldSync, "persist">, directory: Pick<ContactDirectory, "resolve">): TurnFields {
  return {
    afterTurn: async (tenantId, envelope, patch) => {
      await sync.persist(tenantId, async () => (await directory.resolve(tenantId, identityOf(envelope))).id, patch, envelope.flowKey);
    }
  };
}
