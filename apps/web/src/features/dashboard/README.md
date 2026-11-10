# Dashboard — módulo web (`/dashboard`)

Cómo va el negocio, en tres pestañas: **Ventas** (primero la plata de los anuncios: ROAS real frente a Meta, ganancia y costo por venta), **Anuncios** (cada campaña con su venta real) y **Atención** (leads, tiempos de respuesta y cada asesor). Detalle: [`docs/architecture/dashboard.md`](../../../../../docs/architecture/dashboard.md).

```
features/dashboard/
├── pages/        DashboardPage: periodo y filtros (en la dirección) y las pestañas
├── components/   DashboardFilters
├── sales/        AdsHero, SalesKpis, RevenueChart, AdFunnel, CampaignAdvice, Breakdowns, RecentSales
├── ads/          AdsTab (usa la tabla compartida de `shared/ads`)
├── attention/    AttentionTab, Heatmap, AgentsTable
├── services/     dashboardApi (`/dashboard/sales`, `/dashboard/attention`)
└── dashboardFormat.ts · useDashboardData.ts
```
- Quien no tiene `ads.read` (Asesor, Solo lectura) no ve la franja de anuncios ni la pestaña Anuncios, y la página no los pide.
- Cada componente importa su CSS; el panel es un *container* (`dashboard`).
