import { randomBytes, randomUUID } from "node:crypto";
import type { ApiConfig } from "../config/loadApiConfig";
import { publicBaseUrlOf } from "../config/publicBaseUrl";
import type { SqlClient } from "../../../infrastructure/persistence/sql/SqlClient";
import { SqlWebhookRepository } from "../../../infrastructure/persistence/sql/SqlWebhookRepository";
import { AesGcmSecretCipher } from "../../../platform/security/secrets/AesGcmSecretCipher";
import { WebhookAdminServices } from "../../../domains/webhooks/application/WebhookAdminServices";
import { ReceiveWebhookService } from "../../../domains/webhooks/application/ReceiveWebhookService";
import type { WebhookConnections, WebhookContacts, WebhookFlows, WebhookRepository } from "../../../domains/webhooks/application/ports";
import type { ContactsServices } from "./composeContactsServices";
import type { ConnectionsServices } from "./composeConnectionsServices";
import type { MessagingServices } from "./composeMessagingServices";

// ---------------------------------------------------------------------------
// composeWebhookServices — los webhooks de entrada. Une su dominio con
// Contactos, Conexiones y la mensajería con adaptadores (ningún dominio
// importa al otro). Sin `CREDENTIALS_ENCRYPTION_KEY` no hay webhooks: el
// secreto de cada dirección se guarda cifrado.
// ---------------------------------------------------------------------------

export interface WebhookServices {
  readonly admin: WebhookAdminServices;
  readonly receive: ReceiveWebhookService;
}

export interface WebhookDependencies {
  readonly config: ApiConfig;
  readonly sql?: SqlClient;
  readonly repository?: WebhookRepository;
  readonly contacts: Pick<ContactsServices, "directory" | "updateContact">;
  readonly connections: Pick<ConnectionsServices, "list">;
  readonly messaging: Pick<MessagingServices, "flows"> | undefined;
}

export function composeWebhookServices(deps: WebhookDependencies): WebhookServices | null {
  if (!deps.config.credentialsKeyRing) return null;
  const repository = deps.repository ?? new SqlWebhookRepository(deps.sql!);
  const cipher = new AesGcmSecretCipher(deps.config.credentialsKeyRing);

  const contacts: WebhookContacts = {
    identify: async (tenantId, phone, name) => ({ contactId: (await deps.contacts.directory.identify(tenantId, { channel: "whatsapp", externalKey: phone }, name)).profile.id }),
    update: async (tenantId, contactId, change) => {
      if (Object.keys(change.fields).length > 0) await deps.contacts.directory.setFields(tenantId, contactId, change.fields);
      if (change.email) await deps.contacts.updateContact.execute(tenantId, contactId, { email: change.email });
    },
    addTags: async (tenantId, contactId, names) => void (await deps.contacts.directory.addTags(tenantId, contactId, names)),
    removeTags: async (tenantId, contactId, names) => void (await deps.contacts.directory.removeTags(tenantId, contactId, names))
  };
  const connections: WebhookConnections = {
    find: async (tenantId, id) => {
      const connection = (await deps.connections.list.execute(tenantId)).find((item) => item.id === id);
      return connection ? { name: connection.name, connected: connection.status === "connected" } : null;
    }
  };
  const flows: WebhookFlows = {
    launch: async (tenantId, target, flowId) => {
      if (!deps.messaging) throw new Error("los flujos no están disponibles en este servidor.");
      return deps.messaging.flows.launch(tenantId, target, flowId);
    }
  };

  return {
    admin: new WebhookAdminServices({
      repository,
      connections,
      cipher,
      publicBaseUrl: publicBaseUrlOf(deps.config),
      newId: randomUUID,
      newSecret: () => randomBytes(32).toString("base64url")
    }),
    receive: new ReceiveWebhookService({ repository, cipher, contacts, connections, flows })
  };
}
