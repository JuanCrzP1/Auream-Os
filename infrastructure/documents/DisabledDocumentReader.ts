import type { DocumentReadResult, DocumentTextReader } from "../../flow-engine/ports/DocumentTextReader";

/** Entorno que no lee documentos (tests): toda lectura termina en «no disponible». */
export class DisabledDocumentReader implements DocumentTextReader {
  public async read(): Promise<DocumentReadResult> {
    return { ok: false, reason: "unavailable", message: "La lectura de comprobantes no está disponible en este entorno." };
  }
}
