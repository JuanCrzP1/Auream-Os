import { randomUUID } from "node:crypto";
import {
  MEDIA_RULES,
  type MediaAssetSummary,
  type MediaUploadRequest,
  type MediaUploadTicket,
  type RegisterMediaRequest
} from "../../../contracts/MediaContracts";
import { ValidationError } from "../../../platform/observability/errors/ValidationError";
import { TooManyRequestsError } from "../../../platform/observability/errors/TooManyRequestsError";
import type { RateLimiter } from "../../../platform/security/rate-limiting/application/RateLimiter";
import { isMediaKind, mediaIdFromPathname, mediaPathname, type MediaAsset } from "../domain/MediaAsset";
import type { MediaRepository } from "./MediaRepository";
import type { MediaStorage } from "./ports/MediaStorage";

// ---------------------------------------------------------------------------
// Subir un medio en dos pasos, sin que los bytes pasen por la API:
//
//   1. CreateMediaUploadService  valida tipo y tamaño y da un permiso de un
//      solo uso para UNA ruta dentro de la carpeta de la cuenta.
//   2. RegisterMediaService      tras la subida, mira lo que REALMENTE quedó
//      en el almacén (no lo que dice el navegador) y lo registra. Si no cumple
//      las reglas, lo borra.
// ---------------------------------------------------------------------------

const TICKET_TTL_MS = 10 * 60_000;
export const MEDIA_UPLOAD_POLICY = { windowMs: 60_000, maxRequests: 60 };

const MB = 1024 * 1024;
const readableSize = (bytes: number) => `${Math.round(bytes / MB)} MB`;
const KIND_LABEL = { image: "La imagen", video: "El video", audio: "El audio", file: "El archivo" } as const;

export function toMediaSummary(asset: MediaAsset): MediaAssetSummary {
  return {
    id: asset.id,
    kind: asset.kind,
    url: asset.url,
    contentType: asset.contentType,
    size: asset.size,
    fileName: asset.fileName,
    createdAt: asset.createdAt
  };
}

function cleanFileName(value: unknown): string {
  if (typeof value !== "string" || value.trim() === "") throw new ValidationError("Falta el nombre del archivo.");
  return value.trim().slice(0, 200);
}

export class CreateMediaUploadService {
  public constructor(
    private readonly storage: MediaStorage,
    private readonly rateLimiter: RateLimiter,
    private readonly now: () => Date = () => new Date()
  ) {}

  public async execute(tenantId: string, input: Partial<MediaUploadRequest>): Promise<MediaUploadTicket> {
    if (!isMediaKind(input.kind)) throw new ValidationError("Tipo de medio no válido.");
    const rule = MEDIA_RULES[input.kind];
    const fileName = cleanFileName(input.fileName);
    const contentType = typeof input.contentType === "string" ? input.contentType.toLowerCase().split(";")[0]!.trim() : "";
    if (!rule.contentTypes.includes(contentType)) {
      throw new ValidationError(`${KIND_LABEL[input.kind]} debe ser de un formato que WhatsApp acepta (${rule.contentTypes.map((type) => type.split("/")[1]).join(", ")}).`);
    }
    if (typeof input.size !== "number" || !Number.isInteger(input.size) || input.size <= 0) {
      throw new ValidationError("El archivo está vacío.");
    }
    if (input.size > rule.maxBytes) {
      throw new ValidationError(`${KIND_LABEL[input.kind]} supera el máximo de WhatsApp (${readableSize(rule.maxBytes)}).`);
    }

    const limit = await this.rateLimiter.check(`media-upload:${tenantId}`, MEDIA_UPLOAD_POLICY);
    if (!limit.allowed) throw new TooManyRequestsError("Demasiadas subidas seguidas. Espera un momento.", limit.retryAfterMs);

    return this.storage.createUploadTicket({
      pathname: mediaPathname(tenantId, randomUUID(), fileName),
      allowedContentTypes: [contentType],
      maxBytes: rule.maxBytes,
      expiresAt: new Date(this.now().getTime() + TICKET_TTL_MS)
    });
  }
}

export class RegisterMediaService {
  public constructor(
    private readonly repository: MediaRepository,
    private readonly storage: MediaStorage,
    private readonly now: () => Date = () => new Date()
  ) {}

  public async execute(tenantId: string, input: Partial<RegisterMediaRequest>): Promise<MediaAssetSummary> {
    if (!isMediaKind(input.kind)) throw new ValidationError("Tipo de medio no válido.");
    const pathname = typeof input.pathname === "string" ? input.pathname : "";
    const id = mediaIdFromPathname(tenantId, pathname);
    if (!id) throw new ValidationError("Esa subida no pertenece a esta cuenta.");

    const existing = await this.repository.findById(tenantId, id);
    if (existing) return toMediaSummary(existing);

    const stored = await this.storage.describe(pathname);
    if (!stored) throw new ValidationError("El archivo no terminó de subirse. Vuelve a intentarlo.");

    const rule = MEDIA_RULES[input.kind];
    const contentType = stored.contentType.toLowerCase().split(";")[0]!.trim();
    if (!rule.contentTypes.includes(contentType) || stored.size <= 0 || stored.size > rule.maxBytes) {
      await this.storage.remove(pathname);
      throw new ValidationError(`${KIND_LABEL[input.kind]} subido no cumple las reglas de WhatsApp (formato o tamaño).`);
    }

    const asset: MediaAsset = {
      id,
      tenantId,
      kind: input.kind,
      pathname,
      url: stored.url,
      contentType,
      size: stored.size,
      fileName: cleanFileName(input.fileName),
      createdAt: this.now().toISOString()
    };
    await this.repository.save(asset);
    return toMediaSummary(asset);
  }
}
