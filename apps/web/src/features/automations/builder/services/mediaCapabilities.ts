import type { MediaAssetSummary, MediaKind } from "@contracts/MediaContracts";
import { apiErrorMessage } from "@shared/http/apiErrorMessage";
import { uploadMedia } from "@shared/media/uploadMedia";
import type { ToolOutcome } from "../tools/ToolResources";

/** Subir un archivo desde un editor. Nunca lanza: devuelve el medio o un mensaje. */
export async function uploadMediaForTool(
  file: File,
  kind: MediaKind,
  onProgress?: (percentage: number) => void
): Promise<ToolOutcome<MediaAssetSummary>> {
  try {
    return { ok: true, value: await uploadMedia(file, kind, onProgress) };
  } catch (error) {
    return { ok: false, message: apiErrorMessage(error, "No se pudo subir el archivo. Revisa tu conexión e inténtalo de nuevo.") };
  }
}
