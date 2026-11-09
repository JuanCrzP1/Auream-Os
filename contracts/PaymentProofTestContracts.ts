// ---------------------------------------------------------------------------
// «Probar» el Comprobante automático desde el editor: se sube una imagen o PDF
// de ejemplo y se ve qué leyó, qué verificó y por qué salida saldría.
//
// La prueba NO registra el comprobante como usado: solo consulta si ya lo fue.
// ---------------------------------------------------------------------------

/** Tipos que se pueden probar. */
export const PAYMENT_PROOF_TEST_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"] as const;

/**
 * Tope del archivo de prueba. El editor reduce las fotos antes de enviarlas;
 * el cuerpo de la petición (en base64) debe caber en el límite de la API.
 */
export const PAYMENT_PROOF_TEST_MAX_BYTES = 2_500_000;

export interface PaymentProofTestRequest {
  readonly config: Readonly<Record<string, unknown>>;
  readonly file: {
    /** Contenido en base64 (sin el prefijo `data:`). */
    readonly data: string;
    readonly contentType: string;
  };
  /** Valores de ejemplo para las variables del monto esperado. */
  readonly variables?: Readonly<Record<string, string>>;
}

export interface PaymentProofTestCheck {
  readonly id: string;
  readonly passed: boolean;
  readonly detail: string;
}

export interface PaymentProofTestResult {
  /** Id de la salida (`valid`, `wrong-amount`…). */
  readonly output: string;
  readonly message: string;
  readonly checks: ReadonlyArray<PaymentProofTestCheck>;
  /** Datos leídos (`valor`, `fecha`, `referencia`…). */
  readonly fields: Readonly<Record<string, string>>;
  /** Texto que leyó el OCR o el PDF. */
  readonly text?: string;
  readonly method?: "ocr" | "pdf-text";
  readonly durationMs: number;
  readonly missingVariables: ReadonlyArray<string>;
}
