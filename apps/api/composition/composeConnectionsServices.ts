import type { SqlClient } from "../../../infrastructure/persistence/sql/SqlClient";
import { SqlConnectionRepository } from "../../../infrastructure/persistence/sql/SqlConnectionRepository";
import { UnconfiguredWhatsAppLinker } from "../../../infrastructure/whatsapp/UnconfiguredWhatsAppLinker";
import { LinkersByMethod } from "../../../infrastructure/whatsapp/LinkersByMethod";
import { UazapiClient, type FetchLike } from "../../../infrastructure/whatsapp/uazapi/UazapiClient";
import { UazapiLinker } from "../../../infrastructure/whatsapp/uazapi/UazapiLinker";
import { UazapiMessenger } from "../../../infrastructure/whatsapp/uazapi/UazapiMessenger";
import { ConnectionChannelServices } from "../../../domains/connections/application/ConnectionChannelServices";
import { ProviderWebhookKeeper } from "../../../domains/connections/application/ProviderWebhookKeeper";
import type { WhatsAppMessengers } from "../../../domains/connections/application/ports/WhatsAppMessenger";
import { AesGcmSecretCipher, type SecretKeyRing } from "../../../platform/security/secrets/AesGcmSecretCipher";
import { SecretDecryptionError, type SecretCipher } from "../../../platform/security/secrets/SecretCipher";
import type { ConnectionRepository } from "../../../domains/connections/application/ConnectionRepository";
import type { ConnectionTriggerRepository } from "../../../domains/connections/application/ConnectionTriggerRepository";
import type { FlowCatalog } from "../../../domains/connections/application/ports/FlowCatalog";
import { ConnectionTriggerServices } from "../../../domains/connections/application/ConnectionTriggerServices";
import { SqlConnectionTriggerRepository } from "../../../infrastructure/persistence/sql/SqlConnectionTriggerRepository";
import { SqlFlowCatalog } from "../../../infrastructure/persistence/sql/SqlFlowCatalog";
import { InMemoryConnectionTriggerRepository, InMemoryFlowCatalog } from "../../../infrastructure/persistence/memory/InMemoryConnectionTriggerRepository";
import type { WhatsAppLinkers } from "../../../domains/connections/application/ports/WhatsAppLinker";
import {
  CheckConnectionService,
  CreateConnectionService,
  DeleteConnectionService,
  HandleProviderEventService,
  LinkConnectionService,
  ListConnectionsService,
  RenameConnectionService
} from "../../../domains/connections/application/ConnectionServices";

// ---------------------------------------------------------------------------
// composeConnectionsServices — los números de WhatsApp de la cuenta sobre
// PostgreSQL, con el proveedor de cada forma de conectar:
//
//   QR          → uazapi si están UAZAPI_BASE_URL y UAZAPI_ADMIN_TOKEN
//   API oficial → fase siguiente
//
// Sin proveedor, `UnconfiguredWhatsAppLinker` lo dice sin fingir un QR. Los
// tokens de las sesiones se guardan cifrados con la clave maestra.
// ---------------------------------------------------------------------------

export interface ConnectionsServices {
  readonly list: ListConnectionsService;
  readonly create: CreateConnectionService;
  readonly rename: RenameConnectionService;
  readonly remove: DeleteConnectionService;
  readonly link: LinkConnectionService;
  readonly check: CheckConnectionService;
  readonly providerEvents: HandleProviderEventService;
  /** Qué flujo arranca cada número (palabra clave, anuncio, primer mensaje…). */
  readonly triggers: ConnectionTriggerServices;
  /** El canal de cada número: reconocer los avisos de su proveedor y enviar por él. */
  readonly channel: ConnectionChannelServices;
  /** Configuración de avisos de cada número en su proveedor, siempre al día. */
  readonly webhooks: ProviderWebhookKeeper;
  /** Catálogo de flujos (nombre, clave, archivado) que usan disparadores y mensajería. */
  readonly flows: FlowCatalog;
}

export interface ConnectionsOptions {
  readonly keyRing: SecretKeyRing | null;
  readonly uazapi: { readonly baseUrl: string; readonly adminToken: string } | null;
  readonly webhookBaseUrl: string | null;
  readonly fetch?: FetchLike;
}

/** Sin clave maestra no hay sesiones que cifrar: cualquier uso es un error. */
const NO_CIPHER: SecretCipher = {
  encrypt: () => {
    throw new SecretDecryptionError("Falta CREDENTIALS_ENCRYPTION_KEY.");
  },
  decrypt: () => {
    throw new SecretDecryptionError("Falta CREDENTIALS_ENCRYPTION_KEY.");
  }
};

/** Ruta pública donde uazapi avisa los cambios de conexión. */
export const UAZAPI_WEBHOOK_PATH = "/webhooks/uazapi";

/** El proveedor que envía por cada forma de conectar (QR → uazapi). */
export function composeMessengers(options: ConnectionsOptions): WhatsAppMessengers {
  const qr = options.uazapi && options.keyRing ? new UazapiMessenger(new UazapiClient(options.uazapi, options.fetch)) : null;
  return { for: (method) => (method === "qr" ? qr : null) };
}

export function composeLinkers(options: ConnectionsOptions): WhatsAppLinkers {
  const unconfigured = new UnconfiguredWhatsAppLinker();
  const qr =
    options.uazapi && options.keyRing
      ? new UazapiLinker(new UazapiClient(options.uazapi, options.fetch), options.webhookBaseUrl ? `${options.webhookBaseUrl}${UAZAPI_WEBHOOK_PATH}` : null)
      : unconfigured;
  return new LinkersByMethod({ qr, cloud_api: unconfigured });
}

export interface ConnectionsStores {
  readonly connections: ConnectionRepository;
  readonly triggers?: ConnectionTriggerRepository;
  readonly flows?: FlowCatalog;
}

export function composeConnectionsServicesWith(stores: ConnectionsStores | ConnectionRepository, options: ConnectionsOptions): ConnectionsServices {
  const { connections: repository, triggers = new InMemoryConnectionTriggerRepository(), flows = new InMemoryFlowCatalog() } =
    "connections" in stores ? stores : { connections: stores };
  const cipher = options.keyRing ? new AesGcmSecretCipher(options.keyRing) : NO_CIPHER;
  const linkers = composeLinkers(options);
  return {
    list: new ListConnectionsService(repository, triggers),
    create: new CreateConnectionService(repository),
    rename: new RenameConnectionService(repository),
    remove: new DeleteConnectionService(repository, linkers, cipher),
    link: new LinkConnectionService(repository, linkers, cipher),
    check: new CheckConnectionService(repository, linkers, cipher),
    providerEvents: new HandleProviderEventService(repository, cipher),
    triggers: new ConnectionTriggerServices(repository, triggers, flows),
    channel: new ConnectionChannelServices(repository, composeMessengers(options), cipher),
    webhooks: new ProviderWebhookKeeper(linkers, cipher),
    flows
  };
}

export function composeConnectionsServices(sqlClient: SqlClient, options: ConnectionsOptions): ConnectionsServices {
  return composeConnectionsServicesWith(
    { connections: new SqlConnectionRepository(sqlClient), triggers: new SqlConnectionTriggerRepository(sqlClient), flows: new SqlFlowCatalog(sqlClient) },
    options
  );
}
