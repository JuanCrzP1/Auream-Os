import type { SqlClient } from "../../../infrastructure/persistence/sql/SqlClient";
import { SqlAiCredentialRepository } from "../../../infrastructure/persistence/sql/SqlAiCredentialRepository";
import { createAiProviderRegistry, type AiProviderRegistry } from "../../../infrastructure/ai/AiProviderRegistry";
import { DisabledAiGateway } from "../../../infrastructure/ai/DisabledAiGateway";
import { VaultAiGateway } from "./VaultAiGateway";
import { AesGcmSecretCipher, type SecretKeyRing } from "../../../platform/security/secrets/AesGcmSecretCipher";
import type { AiGateway } from "../../../flow-engine/ports/AiGateway";
import { AiCredentialVault } from "../../../domains/integrations/application/AiCredentialVault";
import {
  CreateAiCredentialService,
  DeleteAiCredentialService,
  ListAiCredentialsService,
  ListAiModelsService,
  UpdateAiCredentialService,
  VerifyAiCredentialService
} from "../../../domains/integrations/application/AiCredentialServices";

// ---------------------------------------------------------------------------
// composeIntegrationsServices — conexiones de IA sobre PostgreSQL, cifradas
// con la clave maestra del entorno, y la pasarela que usa el motor.
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

export interface IntegrationsServices {
  /** `null` si no hay clave maestra configurada. */
  readonly aiCredentials: AiCredentialServices | null;
  /** Lo que usa el motor (puerto `AiGateway`). */
  readonly aiGateway: AiGateway;
}

export function composeIntegrationsServices(
  sqlClient: SqlClient,
  keyRing: SecretKeyRing | null,
  providers: AiProviderRegistry = createAiProviderRegistry()
): IntegrationsServices {
  if (!keyRing) return { aiCredentials: null, aiGateway: new DisabledAiGateway() };

  const repository = new SqlAiCredentialRepository(sqlClient);
  const cipher = new AesGcmSecretCipher(keyRing);
  return {
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
