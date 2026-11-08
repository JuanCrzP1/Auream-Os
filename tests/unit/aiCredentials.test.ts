import { beforeEach, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { AesGcmSecretCipher } from "../../platform/security/secrets/AesGcmSecretCipher.js";
import { InMemoryAiCredentialRepository } from "../../infrastructure/persistence/memory/InMemoryAiCredentialRepository.js";
import {
  CreateAiCredentialService,
  DeleteAiCredentialService,
  ListAiCredentialsService,
  ListAiModelsService,
  UpdateAiCredentialService,
  VerifyAiCredentialService
} from "../../domains/integrations/application/AiCredentialServices.js";
import { AiCredentialVault } from "../../domains/integrations/application/AiCredentialVault.js";
import type { AiProviderAccess } from "../../domains/integrations/application/ports/AiProviderAccess.js";
import { ValidationError } from "../../platform/observability/errors/ValidationError.js";
import { ConflictError } from "../../platform/observability/errors/ConflictError.js";
import { NotFoundError } from "../../platform/observability/errors/NotFoundError.js";
import type { AiProviderId } from "../../contracts/AiContracts.js";

// ---------------------------------------------------------------------------
// Conexiones de IA: nada se guarda sin que el proveedor acepte la clave, la
// clave nunca sale en claro y cada cuenta solo ve las suyas.
// ---------------------------------------------------------------------------

const VALID = "sk-test-valida-0123456789abcd";
const T = "11111111-1111-1111-1111-111111111111";
const OTHER = "22222222-2222-2222-2222-222222222222";

class FakeAccess implements AiProviderAccess {
  public checked: Array<[AiProviderId, string]> = [];
  public offline = false;
  public async verifyKey(provider: AiProviderId, apiKey: string) {
    this.checked.push([provider, apiKey]);
    if (this.offline) return { ok: false as const, reason: "unavailable" as const, message: "sin red" };
    return apiKey.includes("valida") ? { ok: true as const } : { ok: false as const, reason: "invalid_key" as const, message: "mala" };
  }
  public listCalls = 0;
  public async listModels() {
    this.listCalls += 1;
    return { ok: true as const, models: [{ id: "gpt-5.4-mini", label: "GPT-5.4 Mini" }] };
  }
}

let repo: InMemoryAiCredentialRepository;
let access: FakeAccess;
const cipher = new AesGcmSecretCipher({ current: "v1", keys: { v1: randomBytes(32) } });

beforeEach(() => {
  repo = new InMemoryAiCredentialRepository();
  access = new FakeAccess();
});

const create = (input: Record<string, unknown>, tenant = T) => new CreateAiCredentialService(repo, cipher, access).execute(tenant, input);

describe("crear", () => {
  it("verifica con el proveedor, cifra y devuelve solo la pista", async () => {
    const summary = await create({ provider: "openai", name: "  OpenAI   principal ", apiKey: ` ${VALID} ` });

    expect(access.checked).toEqual([["openai", VALID]]);
    expect(summary).toMatchObject({ provider: "openai", name: "OpenAI principal", hint: "••••abcd", status: "active" });
    expect(JSON.stringify(summary)).not.toContain(VALID);
    const stored = (await repo.listByTenant(T))[0]!;
    expect(stored.secret).not.toContain(VALID);
    expect(await new AiCredentialVault(repo, cipher).reveal(T, summary.id)).toEqual({ provider: "openai", apiKey: VALID, status: "active" });
  });

  it("una clave rechazada no se guarda", async () => {
    await expect(create({ provider: "openai", name: "X", apiKey: "sk-test-incorrecta-0123456789" })).rejects.toThrow(/rechazó la clave/);
    expect(await repo.listByTenant(T)).toEqual([]);
  });

  it.each([
    [{ provider: "claude", name: "X", apiKey: VALID }, /proveedor/],
    [{ provider: "openai", name: "  ", apiKey: VALID }, /nombre/],
    [{ provider: "openai", name: "X", apiKey: "corta" }, /clave/],
    [{ provider: "openai", name: "X", apiKey: "sk-con espacios-0123456789" }, /clave/]
  ])("valida la entrada %#", async (input, message) => {
    await expect(create(input)).rejects.toThrow(message);
    expect(access.checked).toEqual([]);
  });

  it("nombres únicos por cuenta, sin distinguir mayúsculas", async () => {
    await create({ provider: "openai", name: "Principal", apiKey: VALID });
    await expect(create({ provider: "gemini", name: "principal", apiKey: VALID })).rejects.toBeInstanceOf(ConflictError);
    await expect(create({ provider: "gemini", name: "principal", apiKey: VALID }, OTHER)).resolves.toBeTruthy();
  });
});

describe("cambiar, verificar, borrar y aislar", () => {
  it("cambiar la clave la vuelve a verificar y actualiza la pista; renombrar no la toca", async () => {
    const { id } = await create({ provider: "openai", name: "A", apiKey: VALID });
    const update = new UpdateAiCredentialService(repo, cipher, access);

    expect((await update.execute(T, id, { name: "B" })).name).toBe("B");
    await expect(update.execute(T, id, { apiKey: "sk-test-incorrecta-0123456789" })).rejects.toBeInstanceOf(ValidationError);
    const updated = await update.execute(T, id, { apiKey: "sk-test-valida-nueva-zzzz9999" });
    expect(updated.hint).toBe("••••9999");
    expect((await new AiCredentialVault(repo, cipher).reveal(T, id))?.apiKey).toBe("sk-test-valida-nueva-zzzz9999");
  });

  it("verificar marca como inválida una clave que el proveedor ya no acepta; sin red no la marca", async () => {
    const { id } = await create({ provider: "openai", name: "A", apiKey: VALID });
    const stored = (await repo.findById(T, id))!;
    await repo.save({ ...stored, secret: cipher.encrypt("sk-test-revocada-0123456789", `ai-credential:${T}:${id}`) });
    const verify = new VerifyAiCredentialService(repo, cipher, access);

    expect((await verify.execute(T, id)).status).toBe("invalid");
    access.offline = true;
    await expect(verify.execute(T, id)).rejects.toThrow(/No se pudo comprobar/);
    expect((await repo.findById(T, id))!.status).toBe("invalid");
  });

  it("otra cuenta no ve, no revela, no cambia ni borra conexiones ajenas", async () => {
    const { id } = await create({ provider: "openai", name: "A", apiKey: VALID });

    expect(await new ListAiCredentialsService(repo).execute(OTHER)).toEqual([]);
    expect(await new AiCredentialVault(repo, cipher).reveal(OTHER, id)).toBeNull();
    await expect(new UpdateAiCredentialService(repo, cipher, access).execute(OTHER, id, { name: "Z" })).rejects.toBeInstanceOf(NotFoundError);
    await expect(new DeleteAiCredentialService(repo).execute(OTHER, id)).rejects.toBeInstanceOf(NotFoundError);
    await new DeleteAiCredentialService(repo).execute(T, id);
    expect(await repo.listByTenant(T)).toEqual([]);
  });

  it("un sobre copiado a otra cuenta no se puede descifrar", async () => {
    const { id } = await create({ provider: "openai", name: "A", apiKey: VALID });
    const stored = (await repo.findById(T, id))!;
    await repo.save({ ...stored, tenantId: OTHER });
    await expect(new AiCredentialVault(repo, cipher).reveal(OTHER, id)).rejects.toThrow();
  });

  it("la lista de modelos se pide al proveedor y se recuerda unos minutos", async () => {
    const { id } = await create({ provider: "openai", name: "A", apiKey: VALID });
    let now = 0;
    const models = new ListAiModelsService(repo, cipher, access, 60_000, () => now);

    expect(await models.execute(T, id)).toEqual([{ id: "gpt-5.4-mini", label: "GPT-5.4 Mini" }]);
    await models.execute(T, id);
    expect(access.listCalls).toBe(1);
    now = 61_000;
    await models.execute(T, id);
    expect(access.listCalls).toBe(2);
  });
});
