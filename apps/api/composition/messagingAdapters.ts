import type { InboundContacts } from "../../../domains/messaging/application/ports/MessagingPorts";
import type { SqlTeamRepository } from "../../../infrastructure/persistence/sql/SqlTeamRepository";

/** Quién puede atender chats: el equipo, menos los de solo lectura (igual que el responsable del CRM). */
export function chatTeam(team: SqlTeamRepository) {
  return {
    agents: async (tenantId: string) =>
      (await team.listMembers(tenantId))
        .filter((member) => member.role !== "viewer" && member.role !== "api_client" && member.role !== "worker")
        .map((member) => ({ userId: member.userId, name: member.displayName ?? member.email ?? "Sin nombre", photoUrl: member.photoUrl }))
  };
}

/** Identifica al cliente de cada mensaje y, si ya existía, avisa al CRM que escribió. */
export function inboundContacts(directory: InboundContacts, onWrote?: (tenantId: string, contactId: string) => Promise<void>): InboundContacts {
  if (!onWrote) return directory;
  return {
    identify: async (tenantId, phone, displayName, ad) => {
      const contact = await directory.identify(tenantId, phone, displayName, ad);
      if (!contact.isNew) await onWrote(tenantId, contact.contactId);
      return contact;
    }
  };
}
