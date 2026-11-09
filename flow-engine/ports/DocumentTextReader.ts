// ---------------------------------------------------------------------------
// DocumentTextReader — sacar el texto de una imagen o un PDF.
//
//   PaymentProofNodeHandler → DocumentTextReader → OCR propio (imágenes)
//                                                → texto del PDF
//
// Sin IA ni servicios externos: el reconocimiento corre en el propio servidor
// (`TesseractDocumentReader`). El motor solo recibe texto plano.
// ---------------------------------------------------------------------------

export interface DocumentInput {
  readonly bytes: Uint8Array;
  /** `image/jpeg`, `image/png`, `image/webp`, `application/pdf`… */
  readonly contentType: string;
}

/** Cómo se obtuvo el texto. */
export type DocumentTextMethod = "ocr" | "pdf-text";

/**
 * Por qué no hay texto:
 *   unsupported_type  no es una imagen ni un PDF
 *   unreadable        el archivo está dañado, vacío o no tiene texto legible
 *   timeout           la lectura tardó demasiado
 *   unavailable       este entorno no lee documentos (tests)
 */
export type DocumentReadFailure = "unsupported_type" | "unreadable" | "timeout" | "unavailable";

export type DocumentReadResult =
  | { readonly ok: true; readonly text: string; readonly method: DocumentTextMethod }
  | { readonly ok: false; readonly reason: DocumentReadFailure; readonly message: string };

export interface DocumentTextReader {
  read(document: DocumentInput): Promise<DocumentReadResult>;
}
