// ---------------------------------------------------------------------------
// «Probar» el bloque Pixel desde el editor. Exige el código de prueba del
// Administrador de eventos: así el evento aparece en «Probar eventos» y NO
// cuenta como una conversión real (no ensucia las campañas).
// ---------------------------------------------------------------------------

export interface PixelTestRequest {
  readonly config: Readonly<Record<string, unknown>>;
  /** Código de «Probar eventos» (p. ej. `TEST12345`). Obligatorio. */
  readonly testEventCode: string;
  readonly variables?: Readonly<Record<string, string>>;
}

export interface PixelTestResult {
  readonly succeeded: boolean;
  readonly reason?: string;
  readonly message?: string;
  /** Nombre del evento en Meta (`Lead`, `LeadSubmitted`, `Purchase`). */
  readonly eventName?: string;
  /** `chat` o `business_messaging` (clic a WhatsApp). */
  readonly actionSource?: string;
  readonly value?: number;
  readonly currency?: string;
  readonly eventsReceived?: number;
  readonly durationMs: number;
  readonly missingVariables: ReadonlyArray<string>;
}
