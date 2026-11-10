# Ventas — módulo web (`/sales`)

Cada venta, con su producto, monto, moneda, país, número que vendió, flujo, comprobante y el anuncio que la trajo; la pestaña «Por revisar» y el catálogo de Productos.

Arquitectura y reglas: [`docs/architecture/sales.md`](../../../../../docs/architecture/sales.md).

## Estructura
```
features/sales/
├── pages/        SalesPage (pestañas Ventas · Por revisar · Productos, en `?tab=`)
├── insights/     la portada: SalesHero (total, tendencia y curva), SalesChart (curva monótona),
│                 CurrencyCard (otras monedas), TopProducts, TrendChip
├── orders/       OrdersTab, PeriodPills, SalesListPanel, SalesFilters, SalesTable (iniciales, país y origen),
│                 ReviewEmpty («Todo al día»), SaleDialog (ver, corregir, aprobar, anular), RecordSaleDialog, SaleFields
├── products/     ProductsTab, ProductCard (8 semanas en barras), CatalogEmpty (3 pasos), ProductDialog, PriceRows
├── hooks/        useSales (filtros, «Ver más», corregir) · useSalesInsights (la portada; reintenta sola)
├── services/     salesApi (/sales, /sales/insights, /sales/product-stats)
└── salesFormat.ts · salesIcons.tsx
```
- El catálogo (`/products`) vive en `shared/products` (`useProductCatalog`): también lo usa el bloque Registrar venta del editor de flujos.
- Las pestañas en cápsula son `shared/ui/pill-tabs` (las mismas de Equipo).
- Cada componente importa su propio CSS. Archivos de hasta 200 líneas.
- Los datos que cruzan con la API se tipan en `contracts/` (`@contracts/*`), nunca aquí.

## Habla con
- `orders/` → API `/sales` → dominio `domains/sales`.
- `products/` → API `/products` → dominio `domains/products`.

Mapa de todos los módulos: `docs/architecture/modules.md`.
