import type { MediaUploadTicket } from "../../../../contracts/MediaContracts";

/** Lo que el almacén dice de un objeto ya subido. */
export interface StoredObject {
  readonly url: string;
  readonly size: number;
  readonly contentType: string;
}

export interface UploadPermission {
  readonly pathname: string;
  readonly allowedContentTypes: ReadonlyArray<string>;
  readonly maxBytes: number;
  readonly expiresAt: Date;
}

/**
 * Dónde viven los bytes de los medios. Lo implementan Vercel Blob (nube) y una
 * carpeta local (desarrollo). El dominio no sabe cuál.
 */
export interface MediaStorage {
  /** Permiso de un solo uso para subir ESE objeto, con esos tipos y ese tamaño. */
  createUploadTicket(permission: UploadPermission): Promise<MediaUploadTicket>;
  /** Lo que realmente hay en esa ruta, o `null` si no existe. */
  describe(pathname: string): Promise<StoredObject | null>;
  /** Borra un objeto (p. ej. uno subido que no cumple las reglas). */
  remove(pathname: string): Promise<void>;
}
