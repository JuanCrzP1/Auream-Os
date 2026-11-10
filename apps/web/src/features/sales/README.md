# Ventas — módulo web (`/sales`)

Cada venta, con su producto, monto, moneda, país, número que vendió, flujo, comprobante y el anuncio que la trajo; la pestaña «Por revisar» y el catálogo de Productos.

**Hoy:** `pages/SalesPage.tsx` cuenta lo que traerá.

## Estructura (cada carpeta se crea cuando tiene contenido real)
```
features/sales/
├── pages/        SalesPage (pestañas Ventas · Por revisar · Productos)
├── orders/       historial de ventas, detalle y venta manual
└── products/     catálogo con precio por país y tipo (principal, upsell, downsell)
```
- Cada componente importa su propio CSS. Archivos de hasta 200 líneas.
- Los datos que cruzan con la API se tipan en `contracts/` (`@contracts/*`), nunca aquí.

## Habla con
- `orders/` → API `/sales` → dominio `domains/sales`.
- `products/` → API `/products` → dominio `domains/products`.

Mapa de todos los módulos: `docs/architecture/modules.md`.
