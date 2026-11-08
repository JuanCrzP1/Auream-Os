import { randomUUID } from "node:crypto";
import type { AiCredentialSummary, AiModelOption, CreateAiCredentialRequest, UpdateAiCredentialRequest } from "../../../contracts/AiContracts";
import { SecretDecryptionError, type SecretCipher } from "../../../platform/security/secrets/SecretCipher";
import { NotFoundError } from "../../../platform/observability/errors/NotFoundError";
import { ValidationError } from "../../../platform/observability/errors/ValidationError";
import {
  isAiProviderId,
  keyHint,
  normalizeApiKey,
  normalizeCredentialName,
  secretContext,
  type AiCredential
} from "../domain/AiCredential";
import type { AiCredentialRepository } from "./AiCredentialRepository";
import type { AiProviderAccess } from "./ports/AiProviderAccess";

// ---------------------------------------------------------------------------
// Casos de uso de las conexiones de IA.
//
// Ninguna clave se guarda sin que el proveedor la acepte primero, y ninguna
// sale de aquí en claro: las respuestas son `AiCredentialSummary`. El único
// que descifra para USAR una clave es `AiCredentialVault`.
// ---------------------------------------------------------------------------

export function toAiCredentialSummary(credential: AiCredential): AiCredentialSummary {
  return {
    id: credential.id,
    provider: credential.provider,
    name: credential.name,
    hint: credential.hint,
    status: credential.status,
    lastVerifiedAt: credential.lastVerifiedAt,
    createdAt: credential.createdAt
  };
}

const PROVIDER_NAMES = { openai: "OpenAI", gemini: "Google Gemini", openrouter: "OpenRouter" } as const;

async function requireCredential(repository: AiCredentialRepository, tenantId: string, id: string): Promise<AiCredential> {
  const credential = await repository.findById(tenantId, id);
  if (!credential) throw new NotFoundError("Conexión de IA no encontrada.");
  return credential;
}

/** La clave guardada, en claro. Si no se puede descifrar (otra clave maestra), lo dice. */
function revealKey(cipher: SecretCipher, credential: AiCredential): string {
  try {
    return cipher.decrypt(credential.secret, secretContext(credential.tenantId, credential.id));
  } catch (error) {
    if (error instanceof SecretDecryptionError) {
      throw new ValidationError("No se pudo leer la clave guardada de esta conexión. Vuelve a pegar la clave.");
    }
    throw error;
  }
}

/** Pide al proveedor que acepte la clave; si no, explica por qué. */
async function verifyOrFail(access: AiProviderAccess, provider: AiCredential["provider"], apiKey: string): Promise<void> {
  const check = await access.verifyKey(provider, apiKey);
  if (check.ok) return;
  throw new ValidationError(
    check.reason === "invalid_key"
      ? `${PROVIDER_NAMES[provider]} rechazó la clave. Revisa que esté completa y activa.`
      : `No se pudo comprobar la clave con ${PROVIDER_NAMES[provider]}: ${check.message}`
  );
}

export class ListAiCredentialsService {
  public constructor(private readonly repository: AiCredentialRepository) {}

  public async execute(tenantId: string): Promise<AiCredentialSummary[]> {
    return (await this.repository.listByTenant(tenantId)).map(toAiCredentialSummary);
  }
}

export class CreateAiCredentialService {
  public constructor(
    private readonly repository: AiCredentialRepository,
    private readonly cipher: SecretCipher,
    private readonly access: AiProviderAccess,
    private readonly now: () => Date = () => new Date()
  ) {}

  public async execute(tenantId: string, input: Partial<CreateAiCredentialRequest>): Promise<AiCredentialSummary> {
    if (!isAiProviderId(input.provider)) throw new ValidationError("Elige un proveedor: OpenAI, Google Gemini u OpenRouter.");
    const name = normalizeCredentialName(input.name);
    if (!name) throw new ValidationError("Ponle un nombre de 1 a 60 caracteres (p. ej. «OpenAI principal»).");
    const apiKey = normalizeApiKey(input.apiKey);
    if (!apiKey) throw new ValidationError("La clave de API no parece válida: cópiala completa, sin espacios.");

    await verifyOrFail(this.access, input.provider, apiKey);

    const id = randomUUID();
    const at = this.now().toISOString();
    const credential: AiCredential = {
      id,
      tenantId,
      provider: input.provider,
      name,
      secret: this.cipher.encrypt(apiKey, secretContext(tenantId, id)),
      hint: keyHint(apiKey),
      status: "active",
      lastVerifiedAt: at,
      createdAt: at,
      updatedAt: at
    };
    await this.repository.save(credential);
    return toAiCredentialSummary(credential);
  }
}

export class UpdateAiCredentialService {
  public constructor(
    private readonly repository: AiCredentialRepository,
    private readonly cipher: SecretCipher,
    private readonly access: AiProviderAccess,
    private readonly now: () => Date = () => new Date()
  ) {}

  public async execute(tenantId: string, id: string, input: Partial<UpdateAiCredentialRequest>): Promise<AiCredentialSummary> {
    const current = await requireCredential(this.repository, tenantId, id);
    let next: AiCredential = current;
    const at = this.now().toISOString();

    if (input.name !== undefined) {
      const name = normalizeCredentialName(input.name);
      if (!name) throw new ValidationError("Ponle un nombre de 1 a 60 caracteres.");
      next = { ...next, name };
    }
    if (input.apiKey !== undefined) {
      const apiKey = normalizeApiKey(input.apiKey);
      if (!apiKey) throw new ValidationError("La clave de API no parece válida: cópiala completa, sin espacios.");
      await verifyOrFail(this.access, current.provider, apiKey);
      next = {
        ...next,
        secret: this.cipher.encrypt(apiKey, secretContext(tenantId, id)),
        hint: keyHint(apiKey),
        status: "active",
        lastVerifiedAt: at
      };
    }
    if (next === current) return toAiCredentialSummary(current);

    next = { ...next, updatedAt: at };
    await this.repository.save(next);
    return toAiCredentialSummary(next);
  }
}

export class DeleteAiCredentialService {
  public constructor(private readonly repository: AiCredentialRepository) {}

  public async execute(tenantId: string, id: string): Promise<void> {
    if (!(await this.repository.delete(tenantId, id))) throw new NotFoundError("Conexión de IA no encontrada.");
  }
}

/** Vuelve a comprobar la clave guardada y actualiza su estado. */
export class VerifyAiCredentialService {
  public constructor(
    private readonly repository: AiCredentialRepository,
    private readonly cipher: SecretCipher,
    private readonly access: AiProviderAccess,
    private readonly now: () => Date = () => new Date()
  ) {}

  public async execute(tenantId: string, id: string): Promise<AiCredentialSummary> {
    const current = await requireCredential(this.repository, tenantId, id);
    const apiKey = revealKey(this.cipher, current);
    const check = await this.access.verifyKey(current.provider, apiKey);
    // Si el proveedor no responde, no se marca la clave como inválida.
    if (!check.ok && check.reason === "unavailable") {
      throw new ValidationError(`No se pudo comprobar la clave ahora: ${check.message}`);
    }
    const at = this.now().toISOString();
    const next: AiCredential = { ...current, status: check.ok ? "active" : "invalid", lastVerifiedAt: at, updatedAt: at };
    await this.repository.save(next);
    return toAiCredentialSummary(next);
  }
}

/** Modelos que la cuenta del cliente puede usar con esa conexión. Se recuerdan unos minutos. */
export class ListAiModelsService {
  private readonly cache = new Map<string, { readonly at: number; readonly models: ReadonlyArray<AiModelOption> }>();

  public constructor(
    private readonly repository: AiCredentialRepository,
    private readonly cipher: SecretCipher,
    private readonly access: AiProviderAccess,
    private readonly ttlMs = 10 * 60_000,
    private readonly clock: () => number = Date.now
  ) {}

  public async execute(tenantId: string, id: string): Promise<ReadonlyArray<AiModelOption>> {
    const current = await requireCredential(this.repository, tenantId, id);
    const key = `${tenantId}:${id}:${current.updatedAt}`;
    const cached = this.cache.get(key);
    if (cached && this.clock() - cached.at < this.ttlMs) return cached.models;

    const apiKey = revealKey(this.cipher, current);
    const result = await this.access.listModels(current.provider, apiKey);
    if (!result.ok) throw new ValidationError(`No se pudo leer la lista de modelos: ${result.message}`);
    this.cache.set(key, { at: this.clock(), models: result.models });
    return result.models;
  }
}
