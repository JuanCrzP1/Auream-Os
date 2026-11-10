# crm — embudos, etapas, seguimientos (bounded context)

Opción de la barra: **CRM** (`/crm`). Web: `apps/web/src/features/crm/`. Detalle: [`docs/architecture/crm.md`](../../docs/architecture/crm.md).

## Responsabilidad
El proceso de venta de cada cliente: en qué **etapa** va en cada embudo, cuánto **vale**, quién lo **atiende**, qué **seguimiento** toca y cuándo, y el **historial** de lo que le pasó.

## La regla central
Cada etapa ES una etiqueta de Contactos (`crm_stages.label_id`). Estar en la etapa es tener la etiqueta; un cliente está en una sola etapa por embudo (lo hace cumplir Contactos con los grupos que le da `StageLabelRules`).

## Le pertenece
- `domain/`: `Pipeline` (etapas y su significado: aún no compra · ya compró · no compró), `Deal` (valor por moneda), `FollowUp` (y el día de la empresa), `PipelineMetrics` (avance acumulado, cierre).
- `application/`:
  - `PipelineServices` (configurar);
  - `BoardServices` (tablero, lista, mover);
  - `DealServices` (valor, responsable, ficha);
  - `FollowUpServices`;
  - `StageTracker` (escucha a Contactos y Ventas);
  - `StageLabelRules` (los grupos excluyentes).

## No le pertenece
- Los datos de la persona, sus etiquetas y campos: `domains/contacts`. Las ventas: `domains/sales`. El catálogo: `domains/products`. El equipo: `domains/team`.

## Depende de (por puertos, `application/CrmGateways.ts`)
- `ContactLabeler` y `StageLabels` (Contactos), `CrmProductCatalog` (Productos), `CrmTeamDirectory` (Equipo), `TurnCounter` (el contador del Distribuidor).
- Persistencia: `application/CrmRepositories.ts` → `infrastructure/persistence/sql/SqlCrm*.ts` y `SqlFollowUpRepository.ts` (migración `032_crm.sql`).
