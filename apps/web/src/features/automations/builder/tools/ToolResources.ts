import type { IntegrationTestRequest, IntegrationTestResult } from "@contracts/IntegrationTestContracts";
import type { AiCredentialSummary, AiModelOption, CreateAiCredentialRequest } from "@contracts/AiContracts";
import type { AiTestRequest, AiTestResult } from "@contracts/AiTestContracts";
import type { MediaAssetSummary, MediaKind } from "@contracts/MediaContracts";
import type { PixelConnectionSummary } from "@contracts/PixelContracts";
import type { PaymentProofTestResult } from "@contracts/PaymentProofTestContracts";
import type { PixelTestRequest, PixelTestResult } from "@contracts/PixelTestContracts";

// ---------------------------------------------------------------------------
// Lo que un editor puede usar de la cuenta al configurar:
//
//   · DATOS para ofrecer (el catálogo de etiquetas, las conexiones de IA;
//     mañana píxeles…).
//   · CAPACIDADES puntuales (subir un archivo, crear una etiqueta, conectar
//     una IA, listar sus modelos, probar una integración o un bloque de IA).
//
// Llegan por props, ya preparados: una herramienta nunca llama a la API ni
// conoce el contexto que los carga (`BuilderResourcesProvider`). Las
// capacidades no lanzan: devuelven un resultado o un mensaje para mostrar.
// Los datos son sugerencias, no validación: un flujo puede nombrar algo que
// aún no existe (el motor crea las etiquetas que falten).
// ---------------------------------------------------------------------------

/** Etiqueta del catálogo de la cuenta, tal como la ofrece un editor. */
export interface ToolLabelOption {
  readonly name: string;
  readonly color: string;
}

export type IntegrationTestOutcome =
  | { readonly ok: true; readonly result: IntegrationTestResult }
  | { readonly ok: false; readonly message: string };

export type CreateLabelOutcome =
  | { readonly ok: true; readonly label: ToolLabelOption }
  | { readonly ok: false; readonly message: string };

/** Resultado de una capacidad: el dato, o un mensaje para mostrar. Nunca lanza. */
export type ToolOutcome<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly message: string };

/**
 * Estado de las conexiones de IA de la cuenta para este usuario:
 *   ready        cargadas (puede haber cero)
 *   forbidden    su rol no puede verlas
 *   unavailable  el servidor no tiene el cifrado configurado
 *   loading · error
 */
export type ToolAiCredentialsStatus = "loading" | "ready" | "forbidden" | "unavailable" | "error";

export interface ToolCapabilities {
  /**
   * Sube un archivo (imagen, video, audio, documento) al almacén de la cuenta
   * y devuelve su URL pública y estable. `onProgress` recibe 0–100.
   */
  readonly uploadMedia?: (file: File, kind: MediaKind, onProgress?: (percentage: number) => void) => Promise<ToolOutcome<MediaAssetSummary>>;
  /** Conecta una cuenta de IA (el servidor verifica la clave y la guarda cifrada). */
  readonly createAiCredential?: (request: CreateAiCredentialRequest) => Promise<ToolOutcome<AiCredentialSummary>>;
  /** Modelos que puede usar esa conexión, según el proveedor. */
  readonly listAiModels?: (credentialId: string) => Promise<ToolOutcome<ReadonlyArray<AiModelOption>>>;
  /** Prueba el bloque de IA con un mensaje de ejemplo. */
  readonly testAi?: (request: AiTestRequest) => Promise<ToolOutcome<AiTestResult>>;
  /** Envía el evento de un bloque Pixel con el código de prueba de Meta. */
  readonly testPixel?: (request: PixelTestRequest) => Promise<ToolOutcome<PixelTestResult>>;
  /** Revisa un comprobante de ejemplo con un bloque Comprobante (no lo registra como usado). */
  readonly testPaymentProof?: (
    config: Readonly<Record<string, unknown>>,
    file: File,
    variables: Readonly<Record<string, string>>
  ) => Promise<ToolOutcome<PaymentProofTestResult>>;
  /** Crea una etiqueta en el catálogo de la cuenta (queda para todos los flujos). */
  readonly createLabel?: (input: { readonly name: string; readonly color: string }) => Promise<CreateLabelOutcome>;
  /** Envía una vez la petición de un bloque Integración y devuelve la respuesta. */
  readonly testIntegration?: (request: IntegrationTestRequest) => Promise<IntegrationTestOutcome>;
}

export interface ToolResources extends ToolCapabilities {
  readonly labels: ReadonlyArray<ToolLabelOption>;
  /** Conexiones de IA de la cuenta (sin claves: solo su pista). */
  readonly aiCredentials?: ReadonlyArray<AiCredentialSummary>;
  readonly aiCredentialsStatus?: ToolAiCredentialsStatus;
  /** Píxeles de Meta de la cuenta (sin tokens: solo su pista). */
  readonly pixelConnections?: ReadonlyArray<PixelConnectionSummary>;
  readonly pixelConnectionsStatus?: ToolAiCredentialsStatus;
}

export const EMPTY_TOOL_RESOURCES: ToolResources = { labels: [] };
