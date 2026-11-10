import { put } from "@vercel/blob/client";
import type { MediaUploadTicket } from "@contracts/MediaContracts";

// ---------------------------------------------------------------------------
// Subir los bytes de un archivo con un permiso de un solo uso del servidor:
// directo al almacén, sin pasar por la API.
//
//   vercel-blob  con el SDK de Vercel Blob (producción y vistas previas)
//   direct       PUT a `uploadUrl` (la carpeta local de desarrollo)
//
// Lo usan los medios de los bloques, la foto de perfil y el logo de la empresa.
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

export async function putToStorage(ticket: MediaUploadTicket, file: File, contentType: string, onProgress: UploadProgress = () => {}): Promise<void> {
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
}
