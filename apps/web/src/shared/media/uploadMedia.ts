import { put } from "@vercel/blob/client";
import {
  normalizeMediaContentType,
  type MediaAssetSummary,
  type MediaKind,
  type MediaUploadTicket
} from "@contracts/MediaContracts";
import { builderApiClient } from "@shared/http/builderApiClient";

// ---------------------------------------------------------------------------
// Subir un medio en tres pasos; los bytes nunca pasan por la API:
//
//   1. POST /media/uploads  → permiso de un solo uso (tipo, tamaño, ruta)
//   2. los bytes, directo al almacén: Vercel Blob o la carpeta local de
//      desarrollo, según diga el permiso
//   3. POST /media          → el servidor comprueba lo subido y lo registra
// ---------------------------------------------------------------------------

/** Progreso de la subida, de 0 a 100. */
export type UploadProgress = (percentage: number) => void;

const MULTIPART_FROM_BYTES = 8 * 1024 * 1024;

function putDirect(url: string, file: File, contentType: string, onProgress: UploadProgress): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`upload_${xhr.status}`)));
    xhr.onerror = () => reject(new Error("upload_network"));
    xhr.send(file);
  });
}

export async function uploadMedia(file: File, kind: MediaKind, onProgress: UploadProgress = () => {}): Promise<MediaAssetSummary> {
  const contentType = normalizeMediaContentType(file.type, file.name);
  const ticket = await builderApiClient.post<MediaUploadTicket>("/media/uploads", {
    kind,
    fileName: file.name,
    contentType,
    size: file.size
  });

  if (ticket.strategy === "vercel-blob") {
    await put(ticket.pathname, file, {
      access: "public",
      token: ticket.token,
      contentType,
      multipart: file.size >= MULTIPART_FROM_BYTES,
      onUploadProgress: ({ percentage }) => onProgress(Math.round(percentage))
    });
  } else {
    await putDirect(ticket.uploadUrl, file, contentType, onProgress);
  }

  onProgress(100);
  return builderApiClient.post<MediaAssetSummary>("/media", { kind, pathname: ticket.pathname, fileName: file.name });
}
