import { randomUUID } from "node:crypto";
import { ACCOUNT_IMAGE_RULE, type ImageUploadRequest } from "../../../contracts/AccountContracts";
import type { MediaUploadTicket } from "../../../contracts/MediaContracts";
import { ValidationError } from "../../../platform/observability/errors/ValidationError";
import { TooManyRequestsError } from "../../../platform/observability/errors/TooManyRequestsError";
import type { RateLimiter } from "../../../platform/security/rate-limiting/application/RateLimiter";
import type { MediaStorage } from "./ports/MediaStorage";

// ---------------------------------------------------------------------------
// Imágenes de la cuenta (foto de perfil, logo de la empresa), con las mismas
// garantías que los medios de los bloques:
//
//   ticket   valida tipo y tamaño y da un permiso de un solo uso para UNA ruta
//            nueva dentro de la carpeta del dueño (`folder`)
//   confirm  tras la subida, mira lo que REALMENTE quedó en el almacén (no lo
//            que dice el navegador); si no cumple, lo borra
//   discard  borra una imagen anterior de esa carpeta (nunca lanza)
//
// La carpeta la decide quien llama (`users/<id>/photo/`, `tenants/<id>/brand/`):
// nada fuera de ella se acepta ni se borra.
// ---------------------------------------------------------------------------

const TICKET_TTL_MS = 10 * 60_000;
export const IMAGE_UPLOAD_POLICY = { windowMs: 60_000, maxRequests: 20 };

const EXTENSION: Readonly<Record<string, string>> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const FILE = new RegExp(`^${UUID}\\.(?:jpg|png|webp)$`);

export interface StoredImage {
  readonly pathname: string;
  readonly url: string;
}

const cleanType = (value: unknown) => (typeof value === "string" ? value.toLowerCase().split(";")[0]!.trim() : "");
const allowed = (type: string) => (ACCOUNT_IMAGE_RULE.contentTypes as ReadonlyArray<string>).includes(type);

/** `true` si la ruta es una imagen de esa carpeta, con la forma que dan los permisos. */
export function isImageInFolder(folder: string, pathname: unknown): pathname is string {
  return typeof pathname === "string" && pathname.startsWith(folder) && FILE.test(pathname.slice(folder.length));
}

export class ImageUploads {
  public constructor(
    private readonly storage: MediaStorage,
    private readonly rateLimiter: RateLimiter,
    private readonly now: () => Date = () => new Date()
  ) {}

  public async ticket(folder: string, rateKey: string, input: Partial<ImageUploadRequest>): Promise<MediaUploadTicket> {
    const contentType = cleanType(input.contentType);
    if (!allowed(contentType)) throw new ValidationError("La imagen debe ser JPG, PNG o WebP.");
    if (typeof input.size !== "number" || !Number.isInteger(input.size) || input.size <= 0) throw new ValidationError("La imagen está vacía.");
    if (input.size > ACCOUNT_IMAGE_RULE.maxBytes) throw new ValidationError("La imagen supera el máximo de 5 MB.");

    const limit = await this.rateLimiter.check(`image-upload:${rateKey}`, IMAGE_UPLOAD_POLICY);
    if (!limit.allowed) throw new TooManyRequestsError("Demasiadas subidas seguidas. Espera un momento.", limit.retryAfterMs);

    return this.storage.createUploadTicket({
      pathname: `${folder}${randomUUID()}.${EXTENSION[contentType]}`,
      allowedContentTypes: [contentType],
      maxBytes: ACCOUNT_IMAGE_RULE.maxBytes,
      expiresAt: new Date(this.now().getTime() + TICKET_TTL_MS)
    });
  }

  public async confirm(folder: string, pathname: unknown): Promise<StoredImage> {
    if (!isImageInFolder(folder, pathname)) throw new ValidationError("Esa imagen no es de esta cuenta.");
    const stored = await this.storage.describe(pathname);
    if (!stored) throw new ValidationError("La imagen no terminó de subirse. Vuelve a intentarlo.");
    if (!allowed(cleanType(stored.contentType)) || stored.size <= 0 || stored.size > ACCOUNT_IMAGE_RULE.maxBytes) {
      await this.storage.remove(pathname).catch(() => undefined);
      throw new ValidationError("La imagen subida no es JPG, PNG o WebP de hasta 5 MB.");
    }
    return { pathname, url: stored.url };
  }

  /** Borra una imagen anterior de la carpeta. Si falla, queda huérfana en el almacén: no rompe nada. */
  public async discard(folder: string, pathname: string | null): Promise<void> {
    if (!isImageInFolder(folder, pathname)) return;
    await this.storage.remove(pathname).catch(() => undefined);
  }
}
