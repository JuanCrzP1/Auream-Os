# Dashboard — módulo web (`/dashboard`)

Cómo va el negocio: ventas, facturación, conversaciones, tasa de cierre, ticket promedio y el embudo del anuncio a la venta; con Meta Ads, gasto, ROAS y costo por venta. Filtros por periodo, producto, país, número y anuncio, comparando con el periodo anterior.

**Hoy:** `pages/DashboardPage.tsx` cuenta lo que traerá.

## Estructura (cada carpeta se crea cuando tiene contenido real)
```
features/dashboard/
├── pages/        DashboardPage (pestañas Ventas · Atención)
├── components/   tarjetas de indicadores, gráficos, tablas por producto/país/anuncio
├── hooks/        filtros (periodo, producto, número) y carga de métricas
└── services/     dashboardApi (GET /dashboard)
```
- Cada componente importa su propio CSS. Archivos de hasta 200 líneas.
- Los datos que cruzan con la API se tipan en `contracts/` (`@contracts/*`), nunca aquí.

## Habla con
- API `/dashboard` → dominio `domains/analytics` (lee ventas, chats, gasto y recorrido de los flujos).

Mapa de todos los módulos: `docs/architecture/modules.md`.
