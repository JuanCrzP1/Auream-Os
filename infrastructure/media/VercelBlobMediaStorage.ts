import { BlobNotFoundError, del, head } from "@vercel/blob";
import { generateClientTokenFromReadWriteToken } from "@vercel/blob/client";
import type { MediaUploadTicket } from "../../contracts/MediaContracts";
import type { MediaStorage, StoredObject, UploadPermission } from "../../domains/media/application/ports/MediaStorage";

// ---------------------------------------------------------------------------
// Medios en Vercel Blob (producción y vistas previas).
//
// El navegador sube directo a Blob con un token de cliente que SOLO permite
// esa ruta, esos tipos, ese tamaño y por unos minutos (las funciones de
// Vercel no aceptan cuerpos grandes, y así los bytes no pasan por la API).
// Las URLs son públicas: WhatsApp necesita poder descargarlas.
// ---------------------------------------------------------------------------

export class VercelBlobMediaStorage implements MediaStorage {
  public constructor(private readonly readWriteToken: string) {}

  public async createUploadTicket(permission: UploadPermission): Promise<MediaUploadTicket> {
    const token = await generateClientTokenFromReadWriteToken({
      token: this.readWriteToken,
      pathname: permission.pathname,
      allowedContentTypes: [...permission.allowedContentTypes],
      maximumSizeInBytes: permission.maxBytes,
      validUntil: permission.expiresAt.getTime(),
      addRandomSuffix: false,
      allowOverwrite: false
    });
    return { strategy: "vercel-blob", pathname: permission.pathname, token, expiresAt: permission.expiresAt.toISOString() };
  }

  public async describe(pathname: string): Promise<StoredObject | null> {
    try {
      const blob = await head(pathname, { token: this.readWriteToken });
      return { url: blob.url, size: blob.size, contentType: blob.contentType };
    } catch (error) {
      if (error instanceof BlobNotFoundError) return null;
      throw error;
    }
  }

  public async remove(pathname: string): Promise<void> {
    await del(pathname, { token: this.readWriteToken });
  }
}
