/**
 * Contratos de la API de Automations.
 *
 * Es la representación que cruza HTTP entre `apps/api` y `apps/web`.
 * NO es la entidad de dominio: `domains/automations/catalog/domain/AutomationFlow`
 * tiene `tenantId` y agrupa las fechas bajo `metadata`, porque son datos internos.
 *
 * La traducción entre ambas formas ocurre en un único punto:
 * `apps/api/http/toAutomationListResponse.ts`.
 *
 * Regla: el frontend NUNCA declara su propia versión de estos tipos.
 */

// ---------------------------------------------------------------------------
// AutomationStatus
//
// Vocabulario compartido: el dominio lo usa como estado interno y la UI lo
// renderiza. Vive aquí para que exista una única lista de valores válidos.
// ---------------------------------------------------------------------------

export type AutomationStatus = "active" | "paused" | "draft" | "archived";

// ---------------------------------------------------------------------------
// AutomationSummary
//
// Un flow tal como lo ve el cliente. Aplana `metadata` porque la UI sólo
// necesita la última modificación y las etiquetas.
//
// No expone `tenantId`: el tenant lo determina el servidor a partir de la
// identidad autenticada y no debe viajar al cliente como dato de negocio.
// ---------------------------------------------------------------------------

export interface AutomationSummary {
  readonly id: string;
  readonly key: string;
  readonly name: string;
  readonly status: AutomationStatus;
  readonly folderId?: string;
  readonly updatedAt: string;
  readonly tags?: ReadonlyArray<string>;
}

// ---------------------------------------------------------------------------
// AutomationFolderSummary
// ---------------------------------------------------------------------------

export interface AutomationFolderSummary {
  readonly id: string;
  readonly name: string;
  readonly parentFolderId?: string;
}

// ---------------------------------------------------------------------------
// AutomationListResponse — cuerpo de `GET /automations`
// ---------------------------------------------------------------------------

export interface AutomationListResponse {
  readonly flows: ReadonlyArray<AutomationSummary>;
  readonly folders: ReadonlyArray<AutomationFolderSummary>;
}

// ---------------------------------------------------------------------------
// CreateFolderRequest — cuerpo de `POST /automations/folders`
//
// Sólo el nombre: `id`, `tenantId` y `createdAt` los decide el servidor. La
// respuesta es un `AutomationFolderSummary`, la misma forma que ya devuelve el
// listado, para que el cliente no tenga que conocer dos representaciones.
// ---------------------------------------------------------------------------

export interface CreateFolderRequest {
  readonly name: string;
}
