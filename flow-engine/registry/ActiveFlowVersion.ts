// ---------------------------------------------------------------------------
// ActiveFlowVersion
//
// Representa la versión de un flow que está activa en el runtime de un tenant.
//
// Concepto separado de "publicado": un flow puede tener múltiples snapshots
// publicados en el historial, pero solo UNO está activo (el que el runtime
// usa para nuevas sesiones).
//
// Preparado para persistencia SQL:
//   - `activatedAt` permite auditoría de cuándo se activó cada versión
//   - `activatedBy` opcional para trazabilidad (quién hizo publish/rollback)
//
// En Redis el activatedAt permite implementar TTL de versión activa.
// ---------------------------------------------------------------------------

export interface ActiveFlowVersion {
  readonly tenantId: string;
  readonly flowId: string;
  readonly flowKey: string;
  readonly activeVersionId: string;
  readonly activatedAt: string;
  readonly activatedBy?: string;
}
