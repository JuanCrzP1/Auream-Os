import {
  normalizeMediaContentType,
  type MediaAssetSummary,
  type MediaKind,
  type MediaUploadTicket
} from "@contracts/MediaContracts";
import { builderApiClient } from "@shared/http/builderApiClient";
import { putToStorage, type UploadProgress } from "./putToStorage";

// ---------------------------------------------------------------------------
// Subir un medio en tres pasos; los bytes nunca pasan por la API:
//
//   1. POST /media/uploads  → permiso de un solo uso (tipo, tamaño, ruta)
//   2. los bytes, directo al almacén: Vercel Blob o la carpeta local de
//      desarrollo, según diga el permiso (`putToStorage`)
//   3. POST /media          → el servidor comprueba lo subido y lo registra
// ---------------------------------------------------------------------------

export type { UploadProgress } from "./putToStorage";

export async function uploadMedia(file: File, kind: MediaKind, onProgress: UploadProgress = () => {}): Promise<MediaAssetSummary> {
  const contentType = normalizeMediaContentType(file.type, file.name);
  const ticket = await builderApiClient.post<MediaUploadTicket>("/media/uploads", {
    kind,
    fileName: file.name,
    contentType,
    size: file.size
  });

  await putToStorage(ticket, file, contentType, onProgress);
  return builderApiClient.post<MediaAssetSummary>("/media", { kind, pathname: ticket.pathname, fileName: file.name });
}
