// ---------------------------------------------------------------------------
// «Probar» la Integración desde el editor: se envía la petición configurada,
// con valores de ejemplo para las variables, y se devuelve lo que respondió el
// servicio para elegir qué datos guardar.
// ---------------------------------------------------------------------------

export interface IntegrationTestRequest {
  /** Configuración del bloque tal como está en el editor (sin guardar). */
  readonly config: Readonly<Record<string, unknown>>;
  /** Valores para las variables; las del sistema tienen uno de ejemplo. */
  readonly variables?: Readonly<Record<string, string>>;
}

export interface IntegrationTestPath {
  readonly path: string;
  readonly preview: string;
}

export interface IntegrationTestResult {
  readonly succeeded: boolean;
  /** Motivo del fallo (ver `IntegrationFailureReason`). */
  readonly reason?: string;
  readonly message?: string;
  readonly status?: number;
  readonly durationMs: number;
  readonly contentType?: string;
  /** Cuerpo de la respuesta, recortado para mostrarlo. */
  readonly bodyPreview?: string;
  readonly bodyTruncated: boolean;
  /** Datos de la respuesta que se pueden guardar en el contacto. */
  readonly paths: ReadonlyArray<IntegrationTestPath>;
  /** Lo que guardaría el mapeo configurado con esta respuesta. */
  readonly mapped: Readonly<Record<string, string | number | boolean>>;
  /** Rutas del mapeo que no aparecen en la respuesta. */
  readonly missingPaths: ReadonlyArray<string>;
  /** Variables sin valor (se enviaron vacías). */
  readonly missingVariables: ReadonlyArray<string>;
}
