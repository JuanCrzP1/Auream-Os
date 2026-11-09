import {
  PAYMENT_PROOF_TEST_MAX_BYTES,
  PAYMENT_PROOF_TEST_TYPES,
  type PaymentProofTestResult
} from "@contracts/PaymentProofTestContracts";
import { apiErrorMessage } from "@shared/http/apiErrorMessage";
import type { ToolOutcome } from "../tools/ToolResources";
import { requestBuilderApi } from "./requestBuilderApi";

// ---------------------------------------------------------------------------
// «Probar» del Comprobante automático. Nunca lanza.
//
// Las fotos se reducen en el navegador antes de enviarlas (un comprobante se
// lee bien a ~2000 px): así una foto de 6 MB del celular cabe en la petición
// y la prueba es rápida. Los PDF van tal cual.
// ---------------------------------------------------------------------------

/** Lado mayor con que se envía una foto. */
const MAX_SIDE = 2200;
/** Por debajo de esto la imagen se envía sin tocar. */
const KEEP_BELOW_BYTES = 1_200_000;

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
}

async function shrinkImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.size <= KEEP_BELOW_BYTES) {
    bitmap.close();
    return file;
  }
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("canvas");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("toBlob"))), "image/jpeg", 0.9));
}

export async function testPaymentProof(
  config: Readonly<Record<string, unknown>>,
  file: File,
  variables: Readonly<Record<string, string>>
): Promise<ToolOutcome<PaymentProofTestResult>> {
  const type = file.type.toLowerCase();
  if (!(PAYMENT_PROOF_TEST_TYPES as ReadonlyArray<string>).includes(type)) {
    return { ok: false, message: "Sube una imagen (JPG, PNG o WebP) o un PDF del comprobante." };
  }

  let blob: Blob = file;
  if (type !== "application/pdf") {
    try {
      blob = await shrinkImage(file);
    } catch {
      return { ok: false, message: "No se pudo abrir la imagen. Prueba con otra captura." };
    }
  }
  if (blob.size > PAYMENT_PROOF_TEST_MAX_BYTES) {
    return { ok: false, message: `El archivo pesa más de ${(PAYMENT_PROOF_TEST_MAX_BYTES / 1_000_000).toFixed(1)} MB. Usa una captura de pantalla del comprobante.` };
  }

  try {
    const data = toBase64(await blob.arrayBuffer());
    const value = await requestBuilderApi<PaymentProofTestResult>("/api/builder/payment-proof/test", {
      method: "POST",
      body: JSON.stringify({ config, file: { data, contentType: blob.type || type }, variables })
    });
    return { ok: true, value };
  } catch (error) {
    return { ok: false, message: apiErrorMessage(error, "No se pudo revisar el comprobante. Revisa tu conexión e inténtalo de nuevo.") };
  }
}
