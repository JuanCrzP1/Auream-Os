import type { SqlClient } from "../../../infrastructure/persistence/sql/SqlClient";
import { SqlAiCredentialRepository } from "../../../infrastructure/persistence/sql/SqlAiCredentialRepository";
import { createAiProviderRegistry, type AiProviderRegistry } from "../../../infrastructure/ai/AiProviderRegistry";
import { DisabledAiGateway } from "../../../infrastructure/ai/DisabledAiGateway";
import { VaultAiGateway } from "./VaultAiGateway";
import { AesGcmSecretCipher, type SecretKeyRing } from "../../../platform/security/secrets/AesGcmSecretCipher";
import type { AiGateway } from "../../../flow-engine/ports/AiGateway";
import { AiCredentialVault } from "../../../domains/integrations/application/AiCredentialVault";
import { SqlPixelConnectionRepository } from "../../../infrastructure/persistence/sql/SqlPixelConnectionRepository";
import { MetaConversionsClient } from "../../../infrastructure/meta/MetaConversionsClient";
import { DisabledConversionTracker } from "../../../infrastructure/meta/DisabledConversionTracker";
import type { ConversionTracker } from "../../../flow-engine/ports/ConversionTracker";
import { PixelConnectionVault } from "../../../domains/integrations/application/PixelConnectionVault";
import {
  CreatePixelConnectionService,
  DeletePixelConnectionService,
  ListPixelConnectionsService,
  UpdatePixelConnectionService,
  VerifyPixelConnectionService
} from "../../../domains/integrations/application/PixelConnectionServices";
import { VaultConversionTracker } from "./VaultConversionTracker";
import {
  CreateAiCredentialService,
  DeleteAiCredentialService,
  ListAiCredentialsService,
  ListAiModelsService,
  UpdateAiCredentialService,
  VerifyAiCredentialService
} from "../../../domains/integrations/application/AiCredentialServices";

// ---------------------------------------------------------------------------
// composeIntegrationsServices — conexiones de IA y píxeles de Meta sobre
// PostgreSQL, cifrados con la clave maestra del entorno, y lo que usa el motor
// (pasarela de IA y registro de conversiones).
//
// Sin clave maestra (`CREDENTIALS_ENCRYPTION_KEY`) no hay almacén: los casos
// de uso no se componen (la API responde 503) y el motor sale por «Error»
// con «no disponible». En producción la API ni arranca sin ella.
// ---------------------------------------------------------------------------

export interface AiCredentialServices {
  readonly list: ListAiCredentialsService;
  readonly create: CreateAiCredentialService;
  readonly update: UpdateAiCredentialService;
  readonly remove: DeleteAiCredentialService;
  readonly verify: VerifyAiCredentialService;
  readonly listModels: ListAiModelsService;
}

export interface PixelConnectionServices {
  readonly list: ListPixelConnectionsService;
  readonly create: CreatePixelConnectionService;
  readonly update: UpdatePixelConnectionService;
  readonly remove: DeletePixelConnectionService;
  readonly verify: VerifyPixelConnectionService;
}

export interface IntegrationsServices {
  /** `null` si no hay clave maestra configurada. */
  readonly aiCredentials: AiCredentialServices | null;
  /** Lo que usa el motor (puerto `AiGateway`). */
  readonly aiGateway: AiGateway;
  /** Píxeles de Meta; `null` si no hay clave maestra configurada. */
  readonly pixelConnections: PixelConnectionServices | null;
  /** Lo que usa el motor (puerto `ConversionTracker`). */
  readonly conversionTracker: ConversionTracker;
}

export interface IntegrationsOptions {
  /** Versión de la Graph API de Meta (`META_GRAPH_API_VERSION`). */
  readonly metaGraphVersion?: string;
}

export function composeIntegrationsServices(
  sqlClient: SqlClient,
  keyRing: SecretKeyRing | null,
  providers: AiProviderRegistry = createAiProviderRegistry(),
  options: IntegrationsOptions = {}
): IntegrationsServices {
  if (!keyRing) {
    return { aiCredentials: null, aiGateway: new DisabledAiGateway(), pixelConnections: null, conversionTracker: new DisabledConversionTracker() };
  }

  const repository = new SqlAiCredentialRepository(sqlClient);
  const cipher = new AesGcmSecretCipher(keyRing);
  const pixels = new SqlPixelConnectionRepository(sqlClient);
  const meta = new MetaConversionsClient(options.metaGraphVersion);
  return {
    pixelConnections: {
      list: new ListPixelConnectionsService(pixels),
      create: new CreatePixelConnectionService(pixels, cipher, meta),
      update: new UpdatePixelConnectionService(pixels, cipher, meta),
      remove: new DeletePixelConnectionService(pixels),
      verify: new VerifyPixelConnectionService(pixels, cipher, meta)
    },
    conversionTracker: new VaultConversionTracker(new PixelConnectionVault(pixels, cipher), meta),
    aiCredentials: {
      list: new ListAiCredentialsService(repository),
      create: new CreateAiCredentialService(repository, cipher, providers),
      update: new UpdateAiCredentialService(repository, cipher, providers),
      remove: new DeleteAiCredentialService(repository),
      verify: new VerifyAiCredentialService(repository, cipher, providers),
      listModels: new ListAiModelsService(repository, cipher, providers)
    },
    aiGateway: new VaultAiGateway(new AiCredentialVault(repository, cipher), providers)
  };
}
