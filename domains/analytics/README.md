# analytics — métricas del Dashboard (bounded context)

Opción de la barra: **Dashboard** (`/dashboard`). Web: `apps/web/src/features/dashboard/`.

## Responsabilidad
Responder «¿cómo va el negocio?» con lecturas agregadas: ventas, facturación, conversaciones, tasa de cierre, ticket promedio, el **embudo** del anuncio a la venta (chat → pidió pagar → envió comprobante → aprobada) y, con Meta Ads, gasto, ROAS y costo por venta. Por periodo, producto, país, número y anuncio, comparando con el periodo anterior.

## Le pertenece
- Las vistas del Dashboard:
  - `SalesDashboardService` (Ventas);
  - `AdsDashboardService` (Anuncios);
  - `AttentionDashboardService` (Atención).
- El periodo en la hora de la empresa (`DashboardPeriod`).
- El cambio de moneda con la tasa del día (`CurrencyConverter`, `MoneyBook`).
- El consejo por campaña (`domain/adAdvice.ts`).
- Los eventos de ejecución del motor (`AnalyticsService`, `AnalyticsSink`).

## No le pertenece
Los datos de origen: ventas (`domains/sales`), chats (`domains/conversations`), gasto (`domains/ads`), recorrido de los flujos (`flow_turn_log`). Solo los lee por puertos; nunca escribe en ellos.

## Capas
`application/` (consultas por métrica) · lectura SQL en `infrastructure/persistence/sql`. API: `/dashboard/sales`, `/dashboard/ads`, `/dashboard/attention`. Ficha: [`docs/architecture/dashboard.md`](../../docs/architecture/dashboard.md).
