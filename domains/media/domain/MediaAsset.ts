import { MEDIA_KINDS, type MediaKind } from "../../../contracts/MediaContracts";

/** Un archivo subido por una cuenta y verificado por el servidor. */
export interface MediaAsset {
  readonly id: string;
  readonly tenantId: string;
  readonly kind: MediaKind;
  /** Ruta dentro del almacén: `tenants/<cuenta>/media/<id>/<nombre>`. */
  readonly pathname: string;
  readonly url: string;
  readonly contentType: string;
  readonly size: number;
  readonly fileName: string;
  readonly createdAt: string;
}

export function isMediaKind(value: unknown): value is MediaKind {
  return typeof value === "string" && (MEDIA_KINDS as ReadonlyArray<string>).includes(value);
}

/**
 * Nombre de archivo seguro para una ruta: sin carpetas, sin caracteres raros
 * y con su extensión. «Mi foto (1).JPG» → «mi-foto-1.jpg».
 */
export function safeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  const dot = base.lastIndexOf(".");
  const stem = (dot > 0 ? base.slice(0, dot) : base)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  const extension = dot > 0 ? base.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8) : "";
  return `${stem || "archivo"}${extension ? `.${extension}` : ""}`;
}

/** La carpeta de una cuenta en el almacén. Nada fuera de ella es de esa cuenta. */
export function tenantMediaPrefix(tenantId: string): string {
  return `tenants/${tenantId}/media/`;
}

export function mediaPathname(tenantId: string, mediaId: string, fileName: string): string {
  return `${tenantMediaPrefix(tenantId)}${mediaId}/${safeFileName(fileName)}`;
}

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

/** Id del medio si la ruta es de esa cuenta y tiene la forma esperada; si no, `null`. */
export function mediaIdFromPathname(tenantId: string, pathname: string): string | null {
  const prefix = tenantMediaPrefix(tenantId);
  if (!pathname.startsWith(prefix)) return null;
  const match = new RegExp(`^(${UUID})/[a-z0-9-]+(?:\\.[a-z0-9]{1,8})?$`).exec(pathname.slice(prefix.length));
  return match ? match[1]! : null;
}
