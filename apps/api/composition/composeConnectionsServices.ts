import type { SqlClient } from "../../../infrastructure/persistence/sql/SqlClient";
import { SqlConnectionRepository } from "../../../infrastructure/persistence/sql/SqlConnectionRepository";
import { UnconfiguredWhatsAppLinker } from "../../../infrastructure/whatsapp/UnconfiguredWhatsAppLinker";
import { LinkersByMethod } from "../../../infrastructure/whatsapp/LinkersByMethod";
import { UazapiClient, type FetchLike } from "../../../infrastructure/whatsapp/uazapi/UazapiClient";
import { UazapiLinker } from "../../../infrastructure/whatsapp/uazapi/UazapiLinker";
import { AesGcmSecretCipher, type SecretKeyRing } from "../../../platform/security/secrets/AesGcmSecretCipher";
import { SecretDecryptionError, type SecretCipher } from "../../../platform/security/secrets/SecretCipher";
import type { ConnectionRepository } from "../../../domains/connections/application/ConnectionRepository";
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

export function composeLinkers(options: ConnectionsOptions): WhatsAppLinkers {
  const unconfigured = new UnconfiguredWhatsAppLinker();
  const qr =
    options.uazapi && options.keyRing
      ? new UazapiLinker(new UazapiClient(options.uazapi, options.fetch), options.webhookBaseUrl ? `${options.webhookBaseUrl}${UAZAPI_WEBHOOK_PATH}` : null)
      : unconfigured;
  return new LinkersByMethod({ qr, cloud_api: unconfigured });
}

export function composeConnectionsServicesWith(repository: ConnectionRepository, options: ConnectionsOptions): ConnectionsServices {
  const cipher = options.keyRing ? new AesGcmSecretCipher(options.keyRing) : NO_CIPHER;
  const linkers = composeLinkers(options);
  return {
    list: new ListConnectionsService(repository),
    create: new CreateConnectionService(repository),
    rename: new RenameConnectionService(repository),
    remove: new DeleteConnectionService(repository, linkers, cipher),
    link: new LinkConnectionService(repository, linkers, cipher),
    check: new CheckConnectionService(repository, linkers, cipher),
    providerEvents: new HandleProviderEventService(repository, cipher)
  };
}

export function composeConnectionsServices(sqlClient: SqlClient, options: ConnectionsOptions): ConnectionsServices {
  return composeConnectionsServicesWith(new SqlConnectionRepository(sqlClient), options);
}
