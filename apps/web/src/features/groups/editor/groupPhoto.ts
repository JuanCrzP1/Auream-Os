import { uploadMedia } from "@shared/media/uploadMedia";

/** WhatsApp pide la foto del grupo en JPEG de hasta 640×640: se recorta al centro y se convierte aquí. */
export async function uploadGroupPhoto(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const size = Math.min(640, side);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  canvas.getContext("2d")?.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
  if (!blob) throw new Error("No se pudo preparar la foto.");
  const asset = await uploadMedia(new File([blob], "foto-grupo.jpg", { type: "image/jpeg" }), "image");
  return asset.url;
}
