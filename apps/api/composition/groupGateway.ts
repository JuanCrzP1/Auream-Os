import type { GroupGateway, GroupLabeler, NumberDirectory } from "../../../domains/groups/application/GroupPorts";
import type { ConnectionChannelServices } from "../../../domains/connections/application/ConnectionChannelServices";
import type { ListConnectionsService } from "../../../domains/connections/application/ConnectionServices";
import type { ContactDirectory } from "../../../flow-engine/ports/ContactDirectory";
import { toProviderGroup } from "../../../infrastructure/whatsapp/uazapi/parseUazapiGroups";
import type { UazapiGroupClient } from "../../../infrastructure/whatsapp/uazapi/UazapiGroupClient";
import type { ProviderGroup } from "../../../domains/groups/application/GroupPorts";

// ---------------------------------------------------------------------------
// Grupos ↔ el resto: WhatsApp por la sesión de cada número (Conexiones +
// uazapi), los números de la cuenta y las etiquetas de Contactos. Solo los
// números por QR manejan grupos (la API oficial, más adelante).
// ---------------------------------------------------------------------------

export function uazapiGroupGateway(channel: Pick<ConnectionChannelServices, "sessionFor">, client: UazapiGroupClient): GroupGateway {
  const access = async (tenantId: string, connectionId: string) => {
    const found = await channel.sessionFor(tenantId, connectionId);
    if (!found || found.connection.method !== "qr") throw new Error("Ese número no tiene una sesión por QR activa.");
    return { token: found.session.secret, phone: (found.connection.phoneNumber ?? "").replace(/\D/g, "") || null };
  };
  return {
    list: async (tenantId, connectionId) => {
      const { token, phone } = await access(tenantId, connectionId);
      return (await client.list(token)).map((raw) => toProviderGroup(raw, phone)).filter((group): group is ProviderGroup => group !== null);
    },
    create: async (tenantId, connectionId, name) => ({ jid: await client.create((await access(tenantId, connectionId)).token, name) }),
    configure: async (tenantId, connectionId, jid, settings) => {
      const { token } = await access(tenantId, connectionId);
      if (settings.name !== undefined) await client.updateName(token, jid, settings.name);
      if (settings.description !== undefined) await client.updateDescription(token, jid, settings.description);
      if (settings.imageUrl !== undefined) await client.updateImage(token, jid, settings.imageUrl);
      if (settings.announce !== undefined) await client.updateAnnounce(token, jid, settings.announce);
      if (settings.locked !== undefined) await client.updateLocked(token, jid, settings.locked);
    },
    inviteLink: async (tenantId, connectionId, jid) => client.inviteLink((await access(tenantId, connectionId)).token, jid),
    send: async (tenantId, connectionId, jid, content, mentions) =>
      client.send((await access(tenantId, connectionId)).token, jid, content, mentions === "all" ? "all" : mentions && mentions.length ? mentions.join(",") : null)
  };
}

export function connectionNumbers(list: Pick<ListConnectionsService, "execute">): NumberDirectory {
  return {
    list: async (tenantId) =>
      (await list.execute(tenantId)).map((connection) => ({ id: connection.id, name: connection.name, connected: connection.status === "connected", qr: connection.method === "qr" }))
  };
}

/** Quien entra queda con la etiqueta (se crea si no existe), como lo haría un flujo. */
export function directoryLabeler(directory: ContactDirectory): GroupLabeler {
  return {
    tag: async (tenantId, phone, label) => {
      const contact = await directory.resolve(tenantId, { channel: "whatsapp", externalKey: phone });
      await directory.addTags(tenantId, contact.id, [label.slice(0, 40)]);
    }
  };
}
